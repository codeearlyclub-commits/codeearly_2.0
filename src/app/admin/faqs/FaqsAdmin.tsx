"use client";

/**
 * FAQ editor.
 *
 * These exist so the person answering the same email for the fifth time can
 * publish the answer instead — without waiting for a deploy.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order: number;
};

type Draft = Omit<FaqRow, "category"> & { category: string };

export function FaqsAdmin({ faqs }: { faqs: FaqRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [...new Set(faqs.map((f) => f.category).filter(Boolean))] as string[];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);

    const res = await fetch(
      editing.id ? `/api/admin/faqs/${editing.id}` : "/api/admin/faqs",
      {
        method: editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editing.question,
          answer: editing.answer,
          category: editing.category || null,
          status: editing.status,
          order: Number(editing.order) || 0,
        }),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Could not save that FAQ.");
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(row: FaqRow) {
    if (!confirm(`Delete "${row.question}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/faqs/${row.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not delete that FAQ.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="admin__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setError(null);
            setEditing({
              id: "",
              question: "",
              answer: "",
              category: "",
              status: "DRAFT",
              order: faqs.length,
            });
          }}
        >
          Add a question
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Question</th>
              <th>Category</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {faqs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No questions yet.
                </td>
              </tr>
            )}
            {faqs.map((row) => (
              <tr key={row.id}>
                <td>{row.order}</td>
                <td>
                  <b>{row.question}</b>
                  <br />
                  <span className="muted">
                    {row.answer.length > 110 ? `${row.answer.slice(0, 110)}…` : row.answer}
                  </span>
                </td>
                <td>{row.category ?? "—"}</td>
                <td>
                  <span className={`pill pill--${row.status.toLowerCase()}`}>{row.status}</span>
                </td>
                <td className="table__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing({ ...row, category: row.category ?? "" });
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(row)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit FAQ">
          <form className="modal__box modal__box--wide" onSubmit={save}>
            <h2>{editing.id ? "Edit question" : "Add a question"}</h2>

            <label>
              Question
              <input
                value={editing.question}
                onChange={(e) => setEditing({ ...editing, question: e.target.value })}
                required
                minLength={5}
                maxLength={300}
              />
            </label>

            <label>
              Answer
              <textarea
                rows={6}
                value={editing.answer}
                onChange={(e) => setEditing({ ...editing, answer: e.target.value })}
                required
                minLength={5}
                maxLength={3000}
              />
            </label>

            <div className="row">
              <label>
                Category
                <input
                  list="faq-categories"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  maxLength={60}
                  placeholder="Getting started"
                />
                <datalist id="faq-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label>
                Order
                <input
                  type="number"
                  min={0}
                  value={editing.order}
                  onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                />
              </label>
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Draft["status"] })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>

            <div className="modal__actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
