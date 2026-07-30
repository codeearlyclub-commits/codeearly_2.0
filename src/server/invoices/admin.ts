/**
 * Admin invoice view, and custom invoices.
 *
 * A custom invoice is how you bill something the catalogue does not cover — a
 * private lesson, a late fee, a bespoke workshop. It carries a real pay link, so
 * the parent settles it the same way as anything else and fulfilment correctly
 * grants nothing (there is nothing to unlock; the money IS the point).
 */
import type { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { createInvoice } from "@/server/invoices/create";
import { sendEmail, customInvoiceEmail } from "@/server/email/send";
import { formatNaira } from "@/lib/money";
import { logger } from "@/lib/logger";

export async function listInvoices(opts: { status?: InvoiceStatus; take?: number } = {}) {
  const invoices = await prisma.invoice.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: opts.take ?? 100,
    include: {
      parent: { select: { name: true, email: true } },
      organization: { select: { name: true } },
      payment: { select: { paidAt: true, reference: true } },
    },
  });

  return invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    description: i.description,
    type: i.type,
    amountKobo: i.amountKobo,
    status: i.status,
    payer: i.parent?.name ?? i.organization?.name ?? "—",
    payerEmail: i.parent?.email ?? null,
    createdAt: i.createdAt,
    paidAt: i.paidAt,
    dueDate: i.dueDate,
    reference: i.payment?.reference ?? null,
  }));
}

export async function invoiceTotals() {
  const [pending, paid, cancelled] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { amountKobo: true }, _count: true, where: { status: "PENDING" } }),
    prisma.invoice.aggregate({ _sum: { amountKobo: true }, _count: true, where: { status: "PAID" } }),
    prisma.invoice.aggregate({ _count: true, where: { status: "CANCELLED" } }),
  ]);
  return {
    pendingKobo: pending._sum.amountKobo ?? 0,
    pendingCount: pending._count,
    paidKobo: paid._sum.amountKobo ?? 0,
    paidCount: paid._count,
    cancelledCount: cancelled._count,
  };
}

/**
 * Raise a custom invoice against a parent's email and email them a pay link.
 *
 * Looked up by email rather than taking an id, because the admin is working
 * from a conversation ("bill Mrs Okafor for the extra session"), not from a
 * database. An unknown email is refused rather than silently creating a
 * dangling invoice nobody will ever see.
 */
export async function createCustomInvoice(input: {
  parentEmail: string;
  description: string;
  amountKobo: number;
  dueDate?: string | null;
}) {
  const parent = await prisma.user.findUnique({
    where: { email: input.parentEmail.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!parent) {
    throw errors.notFound(
      `No account with the email ${input.parentEmail}. They must register first.`
    );
  }

  const invoice = await createInvoice({
    parentId: parent.id,
    type: "custom",
    description: input.description,
    amountKobo: input.amountKobo,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
  });

  const payUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/portal/invoices`;
  await sendEmail({
    to: parent.email,
    ...customInvoiceEmail(
      parent.name,
      invoice.invoiceNumber,
      invoice.description,
      formatNaira(invoice.amountKobo),
      payUrl
    ),
  });

  logger.info(
    { invoice: invoice.invoiceNumber, parent: parent.email },
    "custom invoice raised"
  );
  return invoice;
}

/**
 * Cancel an unpaid invoice.
 *
 * A PAID invoice is never cancellable — that would be rewriting an accounting
 * record to match a decision. Refunds are a separate act with their own trail.
 */
export async function cancelInvoice(invoiceNumber: string) {
  const invoice = await prisma.invoice.findUnique({ where: { invoiceNumber } });
  if (!invoice) throw errors.notFound("Invoice not found.");

  if (invoice.status === "PAID") {
    throw errors.conflict(
      "A paid invoice cannot be cancelled. Issue a refund instead — that keeps the record intact."
    );
  }

  return prisma.invoice.update({
    where: { invoiceNumber },
    data: { status: "CANCELLED" },
  });
}
