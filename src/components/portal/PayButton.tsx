"use client";

import { useState } from "react";

/**
 * Pay an existing invoice.
 *
 * Hits the pay endpoint, which re-reads the amount from the invoice row and
 * asks Paystack for a fresh authorisation URL — so a link left open in a tab
 * yesterday cannot be replayed at yesterday's price.
 */
export function PayButton({ invoiceNumber }: { invoiceNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setBusy(true);

    const res = await fetch(
      `/api/portal/invoices/${encodeURIComponent(invoiceNumber)}/pay`,
      { method: "POST" }
    );
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setBusy(false);
      setError(body?.error?.message ?? "Could not start that payment.");
      return;
    }

    // Navigating away — keep the spinner rather than flashing "ready".
    window.location.href = body.authorizationUrl;
  }

  return (
    <>
      <button type="button" className="pbtn pbtn--primary" onClick={pay} disabled={busy}>
        {busy ? "Opening…" : "Pay now"}
      </button>
      {error && (
        <p role="alert" className="pnotice pnotice--warn" style={{ width: "100%", margin: "0.5rem 0 0" }}>
          {error}
        </p>
      )}
    </>
  );
}
