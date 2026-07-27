/**
 * Parent invoices: GET /api/portal/invoices
 *
 * Scoped to the signed-in parent. A child's restricted session must not reach
 * this — what the family owes is not a child's business.
 */
import { apiHandler } from "@/lib/api";
import { requireParent } from "@/lib/session";
import { listParentInvoices } from "@/server/invoices/create";
import { formatNaira } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const parent = await requireParent(req);
  const invoices = await listParentInvoices(parent.userId);

  return {
    invoices: invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      description: inv.description,
      type: inv.type,
      amountKobo: inv.amountKobo,
      amount: formatNaira(inv.amountKobo),
      status: inv.status,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      createdAt: inv.createdAt,
      // The Paystack reference is intentionally omitted: it is an internal
      // handle for reconciliation, not something a payer needs.
    })),
  };
});
