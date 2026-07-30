import Link from "next/link";
import type { InvoiceStatus } from "@prisma/client";

import { listInvoices, invoiceTotals } from "@/server/invoices/admin";
import { formatNaira } from "@/lib/money";
import { InvoiceActions } from "./InvoiceActions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

const FILTERS: Array<{ label: string; value?: InvoiceStatus }> = [
  { label: "All" },
  { label: "Unpaid", value: "PENDING" },
  { label: "Paid", value: "PAID" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default async function AdminInvoicesPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const active = FILTERS.find((f) => f.value === status)?.value;

  const [invoices, totals] = await Promise.all([
    listInvoices({ status: active }),
    invoiceTotals(),
  ]);

  return (
    <>
      <header className="admin__head">
        <h1>Invoices</h1>
        <p className="muted">
          Money owed and received. Totals come from the invoice records; the
          dashboard total comes from the payment ledger — they should agree, and
          a gap between them means something needs looking at.
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat__value">{formatNaira(totals.pendingKobo)}</span>
          <span className="stat__label">Outstanding ({totals.pendingCount})</span>
        </div>
        <div className="stat">
          <span className="stat__value">{formatNaira(totals.paidKobo)}</span>
          <span className="stat__label">Collected ({totals.paidCount})</span>
        </div>
        <div className="stat">
          <span className="stat__value">{totals.cancelledCount}</span>
          <span className="stat__label">Cancelled</span>
        </div>
      </div>

      <nav className="admin__filters">
        {FILTERS.map((f) => {
          const href = f.value ? `/admin/invoices?status=${f.value}` : "/admin/invoices";
          const isActive = f.value === active;
          return (
            <Link key={f.label} href={href} className={isActive ? "is-active" : ""}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      <InvoiceActions />

      <div className="panel">
        {invoices.length === 0 ? (
          <p className="muted">No invoices{active ? ` with status ${active}` : ""}.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Payer</th>
                <th>For</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <code>{invoice.invoiceNumber}</code>
                    <br />
                    <span className="muted">
                      {invoice.createdAt.toLocaleDateString("en-NG")}
                    </span>
                  </td>
                  <td>
                    {invoice.payer}
                    {invoice.payerEmail && (
                      <>
                        <br />
                        <span className="muted">{invoice.payerEmail}</span>
                      </>
                    )}
                  </td>
                  <td>
                    {invoice.description}
                    <br />
                    <span className="pill">{invoice.type}</span>
                  </td>
                  <td>{formatNaira(invoice.amountKobo)}</td>
                  <td>
                    <span className={`pill pill--${invoice.status.toLowerCase()}`}>
                      {invoice.status}
                    </span>
                    {invoice.paidAt && (
                      <>
                        <br />
                        <span className="muted">
                          {invoice.paidAt.toLocaleDateString("en-NG")}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="table__actions">
                    {invoice.status === "PENDING" && (
                      <InvoiceActions cancelNumber={invoice.invoiceNumber} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
