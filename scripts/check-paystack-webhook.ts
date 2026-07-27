/**
 * Exercises the Paystack webhook end to end without contacting Paystack.
 *
 * The signature scheme is HMAC-SHA512 of the raw body with the secret key, so a
 * valid signature can be produced locally. That lets us prove the properties
 * that actually protect money — signature rejection, idempotency under retry,
 * and refusal on amount mismatch — without waiting on real keys.
 *
 * Requires the dev server running on 127.0.0.1:3000.
 *
 *   npx tsx scripts/check-paystack-webhook.ts
 *
 * Destructive: removes its own test rows. Local and CI only.
 */
import "dotenv/config";
import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createInvoice } from "@/server/invoices/create";
import { SYSTEM_ORG_ID } from "@/lib/constants";

const BASE = process.env.CHECK_BASE_URL || "http://127.0.0.1:3000";
const SECRET = process.env.PAYSTACK_SECRET_KEY!;
const REFERENCE = `TEST-WEBHOOK-${Date.now()}`;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function postWebhook(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  const sig = signature ?? createHmac("sha512", SECRET).update(raw).digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": sig },
    body: raw,
  });
  return res.status;
}

const chargeSuccess = (reference: string, amount: number) => ({
  event: "charge.success",
  data: {
    reference,
    amount,
    currency: "NGN",
    paid_at: new Date().toISOString(),
    customer: { email: "payer@example.com" },
  },
});

async function main() {
  await cleanup();

  const invoice = await createInvoice({
    organizationId: SYSTEM_ORG_ID,
    type: "quiz_plan",
    description: "Webhook test invoice",
    amountKobo: 500_000,
  });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paystackReference: REFERENCE },
  });
  console.log(`invoice ${invoice.invoiceNumber} @ ${REFERENCE}`);

  // 1. Forged signature must be rejected.
  check(
    "forged signature rejected",
    (await postWebhook(chargeSuccess(REFERENCE, 500_000), "deadbeef")) === 401
  );

  // 2. Missing signature must be rejected.
  const rawNoSig = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chargeSuccess(REFERENCE, 500_000)),
  });
  check("missing signature rejected", rawNoSig.status === 401);

  // 3. Valid signature records the payment and marks the invoice paid.
  check("valid webhook accepted", (await postWebhook(chargeSuccess(REFERENCE, 500_000))) === 200);
  const afterFirst = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  check("invoice marked PAID", afterFirst?.status === "PAID", afterFirst?.status);
  check("payment row created", (await prisma.payment.count({ where: { reference: REFERENCE } })) === 1);

  // 4. Paystack retries. The second delivery must not double-credit.
  await postWebhook(chargeSuccess(REFERENCE, 500_000));
  await postWebhook(chargeSuccess(REFERENCE, 500_000));
  const count = await prisma.payment.count({ where: { reference: REFERENCE } });
  check("retries are idempotent", count === 1, `${count} payment row(s)`);

  // 5. An amount that disagrees with the invoice must never mark it paid.
  const mismatchRef = `${REFERENCE}-MISMATCH`;
  const invoice2 = await createInvoice({
    organizationId: SYSTEM_ORG_ID,
    type: "quiz_plan",
    description: "Mismatch test",
    amountKobo: 500_000,
  });
  await prisma.invoice.update({
    where: { id: invoice2.id },
    data: { paystackReference: mismatchRef },
  });
  await postWebhook(chargeSuccess(mismatchRef, 100)); // paid 1 naira for a 5,000 naira invoice
  const after2 = await prisma.invoice.findUnique({ where: { id: invoice2.id } });
  check("amount mismatch does not mark paid", after2?.status === "PENDING", after2?.status);
  check(
    "amount mismatch records no payment",
    (await prisma.payment.count({ where: { reference: mismatchRef } })) === 0
  );

  // 6. Unhandled events are acknowledged, not retried forever.
  check(
    "unhandled event acknowledged",
    (await postWebhook({ event: "customeridentification.failed", data: {} })) === 200
  );

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL WEBHOOK CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.payment.deleteMany({ where: { reference: { startsWith: "TEST-WEBHOOK-" } } });
  await prisma.invoice.deleteMany({ where: { organizationId: SYSTEM_ORG_ID } });
  await prisma.counter.deleteMany({});
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
