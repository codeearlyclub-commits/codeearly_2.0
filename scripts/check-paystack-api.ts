/**
 * Verifies the two calls that genuinely reach Paystack: initialize and verify.
 *
 * Requires TEST keys (sk_test_...). It refuses to run against live keys — this
 * creates real transactions, and a script that quietly pointed at production
 * would be creating them on your live account.
 *
 *   npx tsx scripts/check-paystack-api.ts
 *
 * Complements check-paystack-webhook.ts, which covers everything that does NOT
 * need network access and therefore runs in CI. This one does not run in CI,
 * because CI has no keys and should not have any.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createInvoice } from "@/server/invoices/create";
import { initializeTransaction, verifyTransaction } from "@/server/payments/paystack";
import { SYSTEM_ORG_ID } from "@/lib/constants";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) {
    console.error(
      "REFUSING TO RUN: PAYSTACK_SECRET_KEY is not a test key. This script " +
        "creates real transactions."
    );
    process.exit(1);
  }

  await cleanup();

  const invoice = await createInvoice({
    organizationId: SYSTEM_ORG_ID,
    type: "quiz_plan",
    description: "API check — Starter plan",
    amountKobo: 500_000,
  });
  console.log(`invoice ${invoice.invoiceNumber} for ₦5,000`);

  // 1. Initialize returns a checkout URL and stores the reference.
  const { authorizationUrl, reference } = await initializeTransaction(
    invoice,
    "api-check@example.com"
  );
  check("initialize returns a checkout URL", authorizationUrl.startsWith("https://"), authorizationUrl.slice(0, 40) + "…");

  const stored = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  check("reference stored on the invoice", stored?.paystackReference === reference, reference);

  // 2. Verify recognises the reference. An unpaid transaction comes back with a
  //    non-success status — the point is that Paystack knows it, and that we do
  //    NOT treat anything other than "success" as paid.
  const verified = await verifyTransaction(reference);
  check("verify recognises the reference", verified.reference === reference, `status=${verified.status}`);
  check("unpaid transaction is not 'success'", verified.status !== "success", String(verified.status));

  const afterVerify = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  check("unpaid invoice still PENDING", afterVerify?.status === "PENDING", afterVerify?.status);

  // 3. An invoice already paid must never be re-initialized.
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
  let refused = false;
  try {
    await initializeTransaction(
      (await prisma.invoice.findUnique({ where: { id: invoice.id } }))!,
      "api-check@example.com"
    );
  } catch {
    refused = true;
  }
  check("paid invoice cannot be paid again", refused);

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL PAYSTACK API CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.payment.deleteMany({ where: { customerEmail: "api-check@example.com" } });
  await prisma.invoice.deleteMany({ where: { organizationId: SYSTEM_ORG_ID } });
  await prisma.counter.deleteMany({});
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
