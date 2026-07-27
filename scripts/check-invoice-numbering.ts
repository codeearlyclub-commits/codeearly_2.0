/**
 * Proves invoice numbers are gapless across a failed transaction.
 *
 * The failure mode this guards against is subtle: with a Postgres sequence,
 * nextval() survives a rollback, so a failed invoice silently burns a number
 * and the series develops a hole nobody notices until an audit. Run this after
 * touching anything in src/server/invoices.
 *
 *   npx tsx scripts/check-invoice-numbering.ts
 *
 * Destructive: clears invoices for the SYSTEM org and resets counters. Local
 * and CI only — never against production data.
 */
import "dotenv/config";

import { createInvoice } from "@/server/invoices/create";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ORG_ID } from "@/lib/constants";

async function main() {
  await prisma.invoice.deleteMany({ where: { organizationId: SYSTEM_ORG_ID } });
  await prisma.counter.deleteMany({});

  const mk = (description: string, organizationId: string) =>
    createInvoice({
      organizationId,
      type: "quiz_plan",
      description,
      amountKobo: 500_000,
    });

  const first = await mk("first", SYSTEM_ORG_ID);
  const second = await mk("second", SYSTEM_ORG_ID);
  console.log("issued:", first.invoiceNumber, second.invoiceNumber);

  // Fails the FK on organizationId — but only AFTER the counter has been
  // incremented inside the same transaction. That is precisely the case a
  // sequence would get wrong.
  let rolledBack = false;
  try {
    await mk("doomed", "org-that-does-not-exist");
  } catch {
    rolledBack = true;
  }
  console.log("failing insert rolled back:", rolledBack);

  const third = await mk("third", SYSTEM_ORG_ID);
  const gapless = third.invoiceNumber.endsWith("0003");
  console.log("next number:", third.invoiceNumber, gapless ? "GAPLESS ✔" : "GAP ✖");

  await prisma.invoice.deleteMany({ where: { organizationId: SYSTEM_ORG_ID } });
  await prisma.counter.deleteMany({});
  await prisma.$disconnect();

  if (!rolledBack || !gapless) process.exit(1);
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
