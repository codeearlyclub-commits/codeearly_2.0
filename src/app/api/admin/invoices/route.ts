/**
 * Admin invoices: POST (raise a custom invoice) / DELETE (cancel one)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { createCustomInvoice, cancelInvoice } from "@/server/invoices/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  parentEmail: z.string().trim().email().max(160),
  description: z.string().trim().min(3).max(300),
  // Naira, converted server-side. The client never sends kobo for a custom
  // invoice because an admin types what they mean: "5000".
  amountNaira: z.string().trim().min(1).max(20),
  dueDate: z.string().optional().nullable(),
});

const cancelSchema = z.object({
  invoiceNumber: z.string().trim().min(3).max(40),
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, createSchema);

  const { nairaToKobo } = await import("@/lib/money");
  let amountKobo: number;
  try {
    amountKobo = nairaToKobo(body.amountNaira);
  } catch {
    const { errors } = await import("@/lib/errors");
    throw errors.validation("Amount must be a plain figure like 5000 or 5000.50");
  }

  const invoice = await createCustomInvoice({
    parentEmail: body.parentEmail,
    description: body.description,
    amountKobo,
    dueDate: body.dueDate ?? null,
  });

  return { invoiceNumber: invoice.invoiceNumber, amountKobo: invoice.amountKobo };
});

export const DELETE = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, cancelSchema);
  const invoice = await cancelInvoice(body.invoiceNumber);
  return { invoiceNumber: invoice.invoiceNumber, status: invoice.status };
});
