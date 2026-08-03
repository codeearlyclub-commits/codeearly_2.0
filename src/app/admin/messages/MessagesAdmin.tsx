"use client";

/**
 * Enquiry inbox.
 *
 * The point of this screen is that nothing gets lost. V4 emailed enquiries and
 * stored nothing, so an email that bounced, or landed in a folder nobody watched,
 * was a parent who never heard back. Here every enquiry is a row with a state,
 * and NEW ones sort to the top until somebody deals with them.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
};

const NEXT_LABEL: Record<MessageRow["status"], string> = {
  NEW: "Mark read",
  READ: "Mark replied",
  REPLIED: "Archive",
  ARCHIVED: "Reopen",
};

const NEXT_STATUS: Record<MessageRow["status"], MessageRow["status"]> = {
  NEW: "READ",
  READ: "REPLIED",
  REPLIED: "ARCHIVED",
  ARCHIVED: "NEW",
};

export function MessagesAdmin({ messages }: { messages: MessageRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(row: MessageRow, status: MessageRow["status"]) {
    setBusy(row.id);
    setError(null);
    const res = await fetch(`/api/admin/messages/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);

    if (!res.ok) {
      setError("Could not update that enquiry.");
      return;
    }
    router.refresh();
  }

  if (messages.length === 0) {
    return (
      <div className="panel">
        <p className="muted">No enquiries yet.</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {messages.map((row) => (
        <div className={row.status === "NEW" ? "panel panel--warn" : "panel"} key={row.id}>
          <div className="builder__head">
            <div>
              <b>{row.name}</b>{" "}
              <span className={`pill pill--${row.status === "NEW" ? "draft" : "published"}`}>
                {row.status}
              </span>
              <br />
              <a href={`mailto:${row.email}`}>{row.email}</a>
              {row.phone && <span className="muted"> · {row.phone}</span>}
              <br />
              <span className="muted">
                {row.createdAt}
                {row.handledBy ? ` · handled by ${row.handledBy}` : ""}
              </span>
            </div>

            <div className="table__actions">
              <a
                className="table__link"
                href={`mailto:${row.email}?subject=${encodeURIComponent("Re: your message to CodeEarly")}`}
              >
                Reply
              </a>
              <button
                type="button"
                onClick={() => setStatus(row, NEXT_STATUS[row.status])}
                disabled={busy === row.id}
              >
                {NEXT_LABEL[row.status]}
              </button>
            </div>
          </div>

          {/* Rendered as text. An enquiry is untrusted input from a stranger. */}
          <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{row.message}</p>
        </div>
      ))}
    </>
  );
}
