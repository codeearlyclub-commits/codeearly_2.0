"use client";

/**
 * Two jobs in one component: raise a custom invoice, and cancel an unpaid one.
 *
 * Rendered with `cancelNumber` it is a single cancel button for that row;
 * rendered without it, it is the "raise an invoice" panel. Keeping them together
 * means the refresh-after-change behaviour is written once.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvoiceActions({ cancelNumber }: { cancelNumber?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function cancel() {
    if (!cancelNumber) return;
    if (!confirm(`Cancel invoice ${cancelNumber}? The parent will no longer be able to pay it.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/invoices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceNumber: cancelNumber }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.error?.message ?? "Could not cancel that invoice.");
      return;
    }
    router.refresh();
  }

  if (cancelNumber) {
    return (
      <button type="button" onClick={cancel} disabled={busy}>
        Cancel
      </button>
    );
  }

  async function raise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setBusy(true);

    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentEmail: String(data.get("parentEmail") ?? ""),
        description: String(data.get("description") ?? ""),
        amountNaira: String(data.get("amountNaira") ?? ""),
        dueDate: String(data.get("dueDate") ?? "") || null,
      }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not raise that invoice.")
      );
      return;
    }

    setDone(`${body.invoiceNumber} raised and emailed.`);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <div className="admin__actions">
      {!open ? (
        <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
          Raise a custom invoice
        </button>
      ) : (
        <form className="panel" onSubmit={raise}>
          <h2>Custom invoice</h2>
          <p className="muted">
            For anything the catalogue does not cover — a private lesson, an extra
            session, a fee. The parent gets an email with a pay link.
          </p>

          <div className="row">
            <label>
              Parent email
              <input name="parentEmail" type="email" required placeholder="parent@example.com" />
            </label>
            <label>
              Amount (₦)
              <input name="amountNaira" required inputMode="decimal" placeholder="5000" />
            </label>
            <label>
              Due date
              <input name="dueDate" type="date" />
            </label>
          </div>

          <label>
            What is it for?
            <input
              name="description"
              required
              minLength={3}
              maxLength={300}
              placeholder="Private lesson — 3 sessions"
            />
          </label>

          {error && <p role="alert" className="error">{error}</p>}
          {done && <p className="checkout__ok">{done}</p>}

          <div className="modal__actions">
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? "Raising…" : "Raise and email"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
