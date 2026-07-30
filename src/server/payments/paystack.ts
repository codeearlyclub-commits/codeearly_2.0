/**
 * Paystack integration.
 *
 * The rule this whole module is built around: **money is only ever recorded
 * from a source Paystack authenticated**, never from the browser saying a
 * payment succeeded. A client-side callback is a hint to go and check; the
 * webhook and the verify endpoint are the truth.
 *
 * V4's pattern is carried forward, minus its weaknesses: signatures are
 * verified in constant time, and recording a payment is idempotent on the
 * reference, because Paystack retries webhooks and a double-credit is far worse
 * than a duplicate log line.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import type { Invoice } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { formatNaira } from "@/lib/money";
import { sendEmail, paymentReceiptEmail } from "@/server/email/send";
import { fulfilInvoice } from "@/server/payments/fulfilment";

const PAYSTACK_API = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw errors.internal("Payments are not configured yet.", {
      missing: "PAYSTACK_SECRET_KEY",
    });
  }
  return key;
}

/**
 * Start a transaction and get the URL to send the payer to.
 *
 * The amount comes from the invoice row, never from the request — otherwise a
 * caller could pay ₦1 for a ₦50,000 program by editing a form field.
 */
export async function initializeTransaction(
  invoice: Invoice,
  payerEmail: string
): Promise<{ authorizationUrl: string; reference: string }> {
  if (invoice.status === "PAID") {
    throw errors.conflict("That invoice has already been paid.");
  }

  const reference = `CE-${invoice.invoiceNumber}-${Date.now().toString(36).toUpperCase()}`;

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payerEmail,
      amount: invoice.amountKobo, // Paystack takes kobo, which is why we store kobo
      reference,
      callback_url: process.env.PAYSTACK_CALLBACK_URL,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.type,
      },
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: { authorization_url?: string } }
    | null;

  if (!res.ok || !body?.status || !body.data?.authorization_url) {
    logger.error({ status: res.status, message: body?.message }, "Paystack init failed");
    throw errors.paymentFailed("We couldn't start that payment. Please try again.");
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paystackReference: reference },
  });

  return { authorizationUrl: body.data.authorization_url, reference };
}

/** Ask Paystack directly what happened to a reference. */
export async function verifyTransaction(reference: string) {
  const res = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey()}` } }
  );
  const body = (await res.json().catch(() => null)) as {
    status?: boolean;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      paid_at?: string;
      customer?: { email?: string };
    };
  } | null;

  if (!res.ok || !body?.status || !body.data) {
    throw errors.paymentFailed("We couldn't confirm that payment.");
  }
  return body.data;
}

/**
 * Verify a webhook signature.
 *
 * Paystack signs the raw body with HMAC-SHA512 of the secret key. The raw bytes
 * must be used — re-serialising the parsed JSON changes whitespace and key
 * order and the signature will never match.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  // Returns false rather than throwing when unconfigured. The webhook endpoint
  // is public, so a missing key must produce a clean rejection, not a 500 with
  // a stack trace — but it IS a misconfiguration, so say so loudly in the logs.
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    logger.error("PAYSTACK_SECRET_KEY is not set — rejecting webhook unverified");
    return false;
  }

  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Record a successful payment and mark its invoice paid.
 *
 * Idempotent on `reference`: Paystack retries webhooks, and the verify endpoint
 * may be hit by a returning browser at the same moment. Both paths land here,
 * and the second one must be a no-op rather than a second credit.
 */
export async function recordSuccessfulPayment(input: {
  reference: string;
  amountKobo: number;
  currency: string;
  customerEmail: string;
  paidAt: Date;
}): Promise<{ recorded: boolean; invoiceNumber?: string }> {
  const existing = await prisma.payment.findUnique({
    where: { reference: input.reference },
  });
  if (existing) {
    logger.info({ reference: input.reference }, "payment already recorded — ignoring");
    return { recorded: false };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { paystackReference: input.reference },
  });
  if (!invoice) {
    // Money we cannot attribute. Record it anyway rather than dropping it —
    // an unmatched payment is a support problem, but a lost one is a refund.
    logger.error({ reference: input.reference }, "payment for unknown invoice");
  }

  // Amount mismatch means the invoice was altered after initialisation, or the
  // reference was reused. Never mark paid on a mismatch.
  if (invoice && invoice.amountKobo !== input.amountKobo) {
    logger.error(
      { reference: input.reference, expected: invoice.amountKobo, got: input.amountKobo },
      "payment amount does not match invoice"
    );
    throw errors.paymentFailed("Payment amount did not match the invoice.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: invoice?.id ?? null,
        reference: input.reference,
        amountKobo: input.amountKobo,
        currency: input.currency,
        customerEmail: input.customerEmail,
        type: invoice?.type ?? "unknown",
        status: "success",
        paidAt: input.paidAt,
      },
    });
    if (invoice) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", paidAt: input.paidAt },
      });
    }
  });

  // Grant what was bought. Deliberately AFTER the payment is committed and
  // wrapped so a fulfilment failure cannot roll back the money — access pending
  // is a support ticket, money silently rejected is a refund.
  if (invoice) {
    try {
      const result = await fulfilInvoice(invoice);
      logger.info(
        { reference: input.reference, invoice: invoice.invoiceNumber, ...result },
        "invoice fulfilled"
      );
    } catch (err) {
      logger.error(
        { err, reference: input.reference, invoice: invoice.invoiceNumber },
        "PAYMENT RECORDED BUT FULFILMENT FAILED — needs manual grant"
      );
    }
  }

  // Receipt goes out only from here — the webhook-confirmed path — so a
  // browser hitting the callback URL can never trigger a receipt for money we
  // have not actually seen. Enqueued after the transaction commits: a mail
  // failure must not roll back a recorded payment.
  if (invoice) {
    await sendEmail({
      to: input.customerEmail,
      ...paymentReceiptEmail(
        "",
        invoice.invoiceNumber,
        invoice.description,
        formatNaira(invoice.amountKobo),
        input.paidAt
      ),
    });
  }

  return { recorded: true, invoiceNumber: invoice?.invoiceNumber };
}
