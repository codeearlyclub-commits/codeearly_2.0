/**
 * Invoice creation.
 *
 * Two things are non-negotiable here and both are enforced inside a single
 * transaction:
 *
 *  1. The invoice number is **gapless**. Accounting expects an unbroken series,
 *     so the counter is a locked row rather than a Postgres sequence — a
 *     sequence's nextval() survives a rollback and would leave a hole.
 *  2. An invoice is billed to a parent OR an organisation, never both and never
 *     neither. The database enforces it too (`invoice_payer_exactly_one`); the
 *     check here exists to fail with a useful message rather than a 500.
 */
import type { Invoice, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { formatInvoiceNumber } from "@/lib/ids";

export type CreateInvoiceInput = {
  /** Exactly one of these two. */
  parentId?: string | null;
  organizationId?: string | null;
  childId?: string | null;
  type: "program" | "course" | "subscription" | "custom" | "quiz_plan";
  description: string;
  amountKobo: number;
  itemId?: string | null;
  dueDate?: Date | null;
};

/**
 * Take the next number for a year, inside the caller's transaction.
 *
 * `upsert` then `update` rather than a single statement because we need the
 * post-increment value and a row that may not exist yet. Postgres serialises
 * concurrent writers on the row itself.
 */
async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  const key = `invoice:${year}`;
  await tx.counter.upsert({ where: { key }, create: { key, value: 0 }, update: {} });
  const counter = await tx.counter.update({
    where: { key },
    data: { value: { increment: 1 } },
  });
  return formatInvoiceNumber(counter.value, year);
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const payers = [input.parentId, input.organizationId].filter(Boolean).length;
  if (payers !== 1) {
    throw errors.validation(
      "An invoice must be billed to exactly one of a parent or an organisation."
    );
  }
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo < 0) {
    throw errors.validation("Amount must be a whole number of kobo, zero or more.");
  }
  if (!input.description.trim()) {
    throw errors.validation("An invoice needs a description.");
  }

  const year = new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx, year);
    return tx.invoice.create({
      data: {
        invoiceNumber,
        parentId: input.parentId ?? null,
        organizationId: input.organizationId ?? null,
        childId: input.childId ?? null,
        type: input.type,
        description: input.description.trim(),
        amountKobo: input.amountKobo,
        itemId: input.itemId ?? null,
        dueDate: input.dueDate ?? null,
      },
    });
  });
}

/**
 * Fetch an invoice the caller is allowed to see.
 *
 * Ownership is folded into the query, as everywhere else — and "not yours"
 * returns the same not-found as "does not exist", so invoice numbers cannot be
 * enumerated to discover what other people have been billed.
 */
export async function getOwnedInvoice(
  invoiceNumber: string,
  owner: { parentId?: string; organizationId?: string }
): Promise<Invoice> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber,
      ...(owner.parentId ? { parentId: owner.parentId } : {}),
      ...(owner.organizationId ? { organizationId: owner.organizationId } : {}),
    },
  });
  if (!invoice) throw errors.notFound("Invoice not found.", { invoiceNumber });
  return invoice;
}

export async function listParentInvoices(parentId: string) {
  return prisma.invoice.findMany({
    where: { parentId },
    orderBy: { createdAt: "desc" },
    include: { payment: true },
  });
}
