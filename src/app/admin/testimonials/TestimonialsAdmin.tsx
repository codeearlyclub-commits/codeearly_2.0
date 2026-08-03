"use client";

/**
 * Testimonials editor.
 *
 * `order` is an explicit number rather than drag-and-drop. Drag ordering is nicer
 * to use and much worse to get right on touch; a number field is honest, works
 * everywhere, and this list is never long.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export type TestimonialRow = {
  id: string;
  quote: string;
  author: string;
  role: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order: number;
};

type Draft = {
  id: string;
  quote: string;
  author: string;
  role: string;
  status: TestimonialRow["status"];
  order: number;
};

export function TestimonialsAdmin({ testimonials }: { testimonials: TestimonialRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);

    const payload = {
      quote: editing.quote,
      author: editing.author,
      role: editing.role || null,
      status: editing.status,
      order: Number(editing.order) || 0,
    };

    const res = await fetch(
      editing.id ? `/api/admin/testimonials/${editing.id}` : "/api/admin/testimonials",
      {
        method: editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Could not save that testimonial.");
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(row: TestimonialRow) {
    if (!confirm(`Delete the testimonial from ${row.author}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/testimonials/${row.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not delete that testimonial.");
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
              quote: "",
              author: "",
              role: "",
              status: "DRAFT",
              order: testimonials.length,
            });
          }}
        >
          Add a testimonial
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Quote</th>
              <th>Who</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {testimonials.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  None yet. The homepage section stays hidden until there is at
                  least one published.
                </td>
              </tr>
            )}
            {testimonials.map((row) => (
              <tr key={row.id}>
                <td>{row.order}</td>
                <td>{row.quote.length > 120 ? `${row.quote.slice(0, 120)}…` : row.quote}</td>
                <td>
                  <b>{row.author}</b>
                  {row.role && (
                    <>
                      <br />
                      <span className="muted">{row.role}</span>
                    </>
                  )}
                </td>
                <td>
                  <span className={`pill pill--${row.status.toLowerCase()}`}>{row.status}</span>
                </td>
                <td className="table__actions">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing({ ...row, role: row.role ?? "" });
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
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit testimonial">
          <form className="modal__box" onSubmit={save}>
            <h2>{editing.id ? "Edit testimonial" : "Add a testimonial"}</h2>

            <label>
              Quote
              <textarea
                rows={4}
                value={editing.quote}
                onChange={(e) => setEditing({ ...editing, quote: e.target.value })}
                required
                minLength={10}
                maxLength={1200}
              />
            </label>

            <div className="row">
              <label>
                Who said it
                <input
                  value={editing.author}
                  onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                  required
                  maxLength={80}
                  placeholder="Mrs Adeyemi"
                />
              </label>
              <label>
                Their role
                <input
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  maxLength={80}
                  placeholder="Parent of two members"
                />
              </label>
            </div>

            <div className="row">
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
