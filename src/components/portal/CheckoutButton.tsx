"use client";

/**
 * Buy or claim a course/program for a specific child.
 *
 * The child has to be chosen explicitly. An implicit "first child" would
 * quietly enrol the wrong sibling, which is both a refund and an upset
 * conversation — so with more than one child the picker is mandatory.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Child = { id: string; name: string };

export function CheckoutButton({
  kind,
  itemId,
  // Named `kids`, not `children` — `children` is React's own prop name, and
  // shadowing it makes the component read as though it renders them.
  kids,
  label,
  price,
}: {
  kind: "course" | "program";
  itemId: string;
  kids: Child[];
  label: string;
  price: string;
}) {
  const router = useRouter();
  const [childId, setChildId] = useState(kids.length === 1 ? kids[0]!.id : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (kids.length === 0) {
    return (
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
        Add a child first to enrol them.
      </p>
    );
  }

  async function go() {
    if (!childId) {
      setError("Choose which child this is for.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusy(true);

    const res = await fetch("/api/portal/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, childId, itemId }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setBusy(false);
      setError(body?.error?.message ?? "That didn't work. Please try again.");
      return;
    }

    if (body.kind === "payment") {
      // Leave the spinner running — we are navigating away to Paystack, and
      // resetting it would flash "ready" for a moment before the redirect.
      window.location.href = body.authorizationUrl;
      return;
    }

    setBusy(false);
    setMessage(body.message ?? "Done.");
    router.refresh();
  }

  return (
    <div className="checkout">
      {kids.length > 1 && (
        <label className="checkout__child">
          For
          <select value={childId} onChange={(e) => setChildId(e.target.value)}>
            <option value="">Choose a child…</option>
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="checkout__go">
        <button type="button" className="pbtn pbtn--primary" onClick={go} disabled={busy}>
          {busy ? "Working…" : label}
        </button>
        <span className="checkout__price">{price}</span>
      </div>

      {message && <p className="checkout__ok">{message}</p>}
      {error && (
        <p role="alert" className="checkout__error">
          {error}
        </p>
      )}
    </div>
  );
}
