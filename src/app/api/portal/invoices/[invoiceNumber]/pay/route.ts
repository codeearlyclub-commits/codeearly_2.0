/**
 * Start a payment: POST /api/portal/invoices/:invoiceNumber/pay
 *
 * Returns the Paystack URL to redirect to. The invoice is looked up scoped to
 * the signed-in parent, so an invoice number belonging to someone else is a
 * plain not-found — invoice numbers are sequential and therefore trivially
 * guessable, which is exactly why the scoping matters here more than usual.
 */
import { apiHandler, clientIp } from "@/lib/api";
import { requireParent } from "@/lib/session";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { getOwnedInvoice } from "@/server/invoices/create";
import { initializeTransaction } from "@/server/payments/paystack";
import { errors } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ invoiceNumber: string }> };

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const parent = await requireParent(req);
  const { invoiceNumber } = await ctx.params;

  await enforceRateLimit(
    `payment-init:${parent.userId}:${clientIp(req)}`,
    LIMITS.paymentInit.limit,
    LIMITS.paymentInit.window
  );

  const invoice = await getOwnedInvoice(invoiceNumber, { parentId: parent.userId });

  if (invoice.status === "PAID") {
    throw errors.conflict("That invoice has already been paid.");
  }
  if (invoice.status === "CANCELLED") {
    throw errors.conflict("That invoice was cancelled.");
  }

  const { authorizationUrl, reference } = await initializeTransaction(
    invoice,
    parent.email
  );

  return { authorizationUrl, reference, invoiceNumber: invoice.invoiceNumber };
});
