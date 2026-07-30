/**
 * Proves that paying for something actually grants it.
 *
 * This closes a real hole: recording a payment used to mark the invoice PAID and
 * send a receipt while granting NOTHING. The money was taken, the ledger looked
 * correct, and the child had no access — the worst possible failure, because
 * every signal said it had worked.
 *
 * Requires the dev server on 127.0.0.1:3000 (it posts a signed webhook).
 *
 *   npx tsx scripts/check-fulfilment.ts
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";
import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { createChild } from "@/server/members/children";
import { checkoutCourse } from "@/server/invoices/checkout";

const BASE = process.env.CHECK_BASE_URL || "http://127.0.0.1:3000";
const SECRET = process.env.PAYSTACK_SECRET_KEY!;
const PARENT_ID = "fulfilment-check-parent";
const EMAIL = "fulfilment-check@example.com";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function postWebhook(reference: string, amountKobo: number) {
  const raw = JSON.stringify({
    event: "charge.success",
    data: {
      reference,
      amount: amountKobo,
      currency: "NGN",
      paid_at: new Date().toISOString(),
      customer: { email: EMAIL },
    },
  });
  const signature = createHmac("sha512", SECRET).update(raw).digest("hex");
  const res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signature },
    body: raw,
  });
  return res.status;
}

async function main() {
  await cleanup();

  await prisma.user.create({
    data: {
      id: PARENT_ID,
      email: EMAIL,
      name: "Fulfilment Check",
      emailVerified: true,
      updatedAt: new Date(),
    },
  });
  const child = await createChild({ parentId: PARENT_ID, childName: "Ada" });

  const course = await prisma.course.create({
    data: {
      title: "Fulfilment Check Course",
      slug: "fulfilment-check-course",
      status: "PUBLISHED",
      priceKobo: 250_000,
    },
  });

  // 1. Checkout produces an invoice and a payment link, and does NOT grant yet.
  const result = await checkoutCourse(PARENT_ID, EMAIL, child.id, course.id);
  check("checkout returns a payment link", result.kind === "payment");
  if (result.kind !== "payment") {
    await cleanup();
    process.exit(1);
  }

  const notYet = await prisma.enrollment.count({
    where: { childId: child.id, courseId: course.id },
  });
  check("no access before payment", notYet === 0, `${notYet} enrolment(s)`);

  const invoice = await prisma.invoice.findFirst({
    where: { invoiceNumber: result.invoiceNumber },
  });
  check("invoice starts PENDING", invoice?.status === "PENDING", invoice?.status);
  check("invoice priced from the course row", invoice?.amountKobo === 250_000);
  check("invoice remembers the course", invoice?.itemId === course.id);
  check("invoice remembers the child", invoice?.childId === child.id);

  // 2. The webhook arrives — this must both mark it paid AND grant access.
  const status = await postWebhook(invoice!.paystackReference!, 250_000);
  check("webhook accepted", status === 200, `HTTP ${status}`);

  const after = await prisma.invoice.findUnique({ where: { id: invoice!.id } });
  check("invoice now PAID", after?.status === "PAID", after?.status);

  const granted = await prisma.enrollment.count({
    where: { childId: child.id, courseId: course.id },
  });
  check("ACCESS GRANTED after payment", granted === 1, `${granted} enrolment(s)`);

  // 3. Paystack retries. Fulfilment must not duplicate.
  await postWebhook(invoice!.paystackReference!, 250_000);
  await postWebhook(invoice!.paystackReference!, 250_000);
  const stillOne = await prisma.enrollment.count({
    where: { childId: child.id, courseId: course.id },
  });
  check("retries do not duplicate access", stillOne === 1, `${stillOne} enrolment(s)`);

  const payments = await prisma.payment.count({
    where: { reference: invoice!.paystackReference! },
  });
  check("retries do not double-charge", payments === 1, `${payments} payment row(s)`);

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL FULFILMENT CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.payment.deleteMany({ where: { customerEmail: EMAIL } });
  await prisma.invoice.deleteMany({ where: { parentId: PARENT_ID } });
  await prisma.course.deleteMany({ where: { slug: "fulfilment-check-course" } });
  await prisma.user.deleteMany({ where: { id: PARENT_ID } });
  await prisma.counter.deleteMany({});
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
