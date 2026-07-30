/**
 * Portal payments — every invoice, with a way to pay the unpaid ones.
 *
 * Unpaid invoices are listed first regardless of date. A parent opening this
 * page almost always came to settle something, not to browse history.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listParentInvoices } from "@/server/invoices/create";
import { formatNaira } from "@/lib/money";
import { PayButton } from "@/components/portal/PayButton";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const invoices = await listParentInvoices(session.user.id);
  const unpaid = invoices.filter((i) => i.status === "PENDING");
  const settled = invoices.filter((i) => i.status !== "PENDING");
  const owed = unpaid.reduce((sum, i) => sum + i.amountKobo, 0);

  return (
    <main className="portal-page">
      <h1>Payments</h1>

      {invoices.length === 0 && (
        <p className="muted">
          Nothing to pay. Invoices appear here when you enrol a child in a paid
          course or program.
        </p>
      )}

      {unpaid.length > 0 && (
        <section className="panel panel--warn">
          <h2>
            {unpaid.length} unpaid · {formatNaira(owed)}
          </h2>
          <ul className="invoice-list">
            {unpaid.map((invoice) => (
              <li key={invoice.id}>
                <div>
                  <b>{invoice.description}</b>
                  <br />
                  <span className="muted">
                    {invoice.invoiceNumber}
                    {invoice.dueDate &&
                      ` · due ${invoice.dueDate.toLocaleDateString("en-NG")}`}
                  </span>
                </div>
                <div className="invoice-list__pay">
                  <b>{formatNaira(invoice.amountKobo)}</b>
                  <PayButton invoiceNumber={invoice.invoiceNumber} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {settled.length > 0 && (
        <section className="panel">
          <h2>History</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>For</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {settled.map((invoice) => (
                <tr key={invoice.id}>
                  <td><code>{invoice.invoiceNumber}</code></td>
                  <td>{invoice.description}</td>
                  <td>{formatNaira(invoice.amountKobo)}</td>
                  <td>
                    <span className={`pill pill--${invoice.status.toLowerCase()}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td>
                    {invoice.paidAt ? invoice.paidAt.toLocaleDateString("en-NG") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
