/**
 * Paystack webhook: POST /api/webhooks/paystack
 *
 * The authoritative source of "this was paid". Three rules:
 *
 *  1. Read the RAW body and verify the signature against it. Parsing first and
 *     re-serialising changes bytes, and the HMAC will never match.
 *  2. Reject anything unsigned. This endpoint is public by necessity, so the
 *     signature is the only thing separating Paystack from anyone who can POST.
 *  3. Answer 200 quickly, even for events we ignore. A non-2xx makes Paystack
 *     retry, and retrying an event we simply do not handle achieves nothing.
 */
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { verifyWebhookSignature, recordSuccessfulPayment } from "@/server/payments/paystack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn({ hasSignature: Boolean(signature) }, "rejected unsigned paystack webhook");
    // 401, not 400: this is an authentication failure, and it must never look
    // like a malformed-payload problem Paystack should retry.
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
      customer?: { email?: string };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (event.event !== "charge.success" || !event.data?.reference) {
    logger.info({ event: event.event }, "paystack webhook ignored");
    return NextResponse.json({ received: true });
  }

  try {
    const result = await recordSuccessfulPayment({
      reference: event.data.reference,
      amountKobo: Number(event.data.amount ?? 0),
      currency: event.data.currency ?? "NGN",
      customerEmail: event.data.customer?.email ?? "",
      paidAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
    });
    logger.info(
      { reference: event.data.reference, ...result },
      result.recorded ? "payment recorded" : "duplicate webhook ignored"
    );
  } catch (err) {
    // Log loudly and still return 200. A retry would hit the same mismatch and
    // Paystack would keep retrying forever; this needs a human, not a redelivery.
    logger.error({ err, reference: event.data.reference }, "failed to record payment");
  }

  return NextResponse.json({ received: true });
}
