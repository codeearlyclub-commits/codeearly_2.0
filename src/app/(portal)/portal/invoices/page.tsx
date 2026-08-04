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

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PortalInvoicesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const invoices = await listParentInvoices(session.user.id);
  const unpaid = invoices.filter((i) => i.status === "PENDING");
  const settled = invoices.filter((i) => i.status !== "PENDING");
  const owed = unpaid.reduce((sum, i) => sum + i.amountKobo, 0);

  return (
    <>
      <header className="portal-head">
        <h1>Payments</h1>
        <p>Every invoice on your account, and receipts for what you have paid.</p>
      </header>

      {invoices.length === 0 && (
        <div className="pempty">
          <div className="pempty__icon">🧾</div>
          <h3>Nothing to pay</h3>
          <p>
            Invoices appear here when you enrol a child on a paid course or program.
          </p>
        </div>
      )}

      {unpaid.length > 0 && (
        <section className="portal-section">
          <div className="money-strip money-strip--owing" style={{ marginBottom: "1rem" }}>
            <div className="money-strip__main">
              <div className="money-strip__label">Outstanding</div>
              <div className="money-strip__value">{formatNaira(owed)}</div>
              <div className="money-strip__note">
                across {unpaid.length} invoice{unpaid.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {unpaid.map((invoice) => (
            <div className="prow" key={invoice.id}>
              <div className="prow__main">
                <div className="prow__title">{invoice.description}</div>
                <div className="prow__sub">
                  {invoice.invoiceNumber}
                  {invoice.dueDate ? ` · due ${dateFmt.format(invoice.dueDate)}` : ""}
                </div>
              </div>
              <div className="prow__end">
                <span className="prow__amount">{formatNaira(invoice.amountKobo)}</span>
                <PayButton invoiceNumber={invoice.invoiceNumber} />
              </div>
            </div>
          ))}
        </section>
      )}

      {settled.length > 0 && (
        <section className="portal-section">
          <div className="portal-section__head">
            <h2>History</h2>
          </div>
          {settled.map((invoice) => (
            <div className="prow" key={invoice.id}>
              <div className="prow__main">
                <div className="prow__title">{invoice.description}</div>
                <div className="prow__sub">
                  {invoice.invoiceNumber}
                  {invoice.paidAt ? ` · paid ${dateFmt.format(invoice.paidAt)}` : ""}
                </div>
              </div>
              <div className="prow__end">
                <span className="prow__amount">{formatNaira(invoice.amountKobo)}</span>
                <span className={`ppill ppill--${invoice.status.toLowerCase()}`}>
                  {invoice.status}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
