"use client";

/**
 * Course editor.
 *
 * Prices are typed in naira and converted to kobo at the boundary — an admin
 * should never have to think in kobo, and the conversion living in one place
 * means it cannot be done differently on two screens.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { nairaToKobo, koboToNaira, formatPrice } from "@/lib/money";

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  level: string | null;
  ageRange: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  priceKobo: number;
  requiresSubscription: boolean;
  programOnly: boolean;
  sortOrder: number;
  enrolments: number;
};

type Draft = {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  ageRange: string;
  status: Course["status"];
  priceNaira: string;
  requiresSubscription: boolean;
  programOnly: boolean;
  sortOrder: number;
};

const BLANK: Draft = {
  id: "",
  title: "",
  slug: "",
  description: "",
  level: "",
  ageRange: "",
  // New courses start unpublished. Publishing should be a decision, not the
  // consequence of forgetting to change a dropdown.
  status: "DRAFT",
  priceNaira: "0",
  requiresSubscription: false,
  programOnly: false,
  sortOrder: 0,
};

export function CoursesAdmin({ initial }: { initial: Course[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setError(null);
    setEditing({ ...BLANK });
  }

  function openEdit(course: Course) {
    setError(null);
    setEditing({
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description ?? "",
      level: course.level ?? "",
      ageRange: course.ageRange ?? "",
      status: course.status,
      priceNaira: String(koboToNaira(course.priceKobo)),
      requiresSubscription: course.requiresSubscription,
      programOnly: course.programOnly,
      sortOrder: course.sortOrder,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);

    let priceKobo: number;
    try {
      priceKobo = nairaToKobo(editing.priceNaira || "0");
    } catch {
      setError("Price must be a plain amount like 2500 or 2500.50");
      return;
    }

    setBusy(true);
    const payload = {
      title: editing.title,
      description: editing.description || null,
      level: editing.level || null,
      ageRange: editing.ageRange || null,
      status: editing.status,
      priceKobo,
      requiresSubscription: editing.requiresSubscription,
      programOnly: editing.programOnly,
      sortOrder: Number(editing.sortOrder) || 0,
    };

    const res = await fetch(
      editing.id ? `/api/admin/courses/${editing.id}` : "/api/admin/courses",
      {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not save that course.")
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(course: Course) {
    const warning =
      course.enrolments > 0
        ? `${course.title} has ${course.enrolments} enrolment(s). It will be ARCHIVED rather than deleted, so those records survive. Continue?`
        : `Delete ${course.title}? Nobody is enrolled, so this removes it entirely.`;
    if (!confirm(warning)) return;

    setBusy(true);
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      setError("Could not remove that course.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}

      <div className="admin__actions">
        <button type="button" className="btn btn--primary" onClick={openNew}>
          New course
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Ages</th>
              <th>Price</th>
              <th>Enrolled</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No courses yet. Create your first one.
                </td>
              </tr>
            )}
            {initial.map((course) => (
              <tr key={course.id}>
                <td>
                  <b>{course.title}</b>
                  <br />
                  <code className="muted">/{course.slug}</code>
                  {course.programOnly && <span className="pill pill--lock">program only</span>}
                  {course.requiresSubscription && <span className="pill">members</span>}
                </td>
                <td>
                  <span className={`pill pill--${course.status.toLowerCase()}`}>
                    {course.status}
                  </span>
                </td>
                <td>{course.ageRange || "—"}</td>
                <td>{formatPrice(course.priceKobo)}</td>
                <td>{course.enrolments}</td>
                <td className="table__actions">
                  <button type="button" onClick={() => openEdit(course)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(course)} disabled={busy}>
                    {course.enrolments > 0 ? "Archive" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit course">
          <form className="modal__box" onSubmit={save}>
            <h2>{editing.id ? "Edit course" : "New course"}</h2>

            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
                maxLength={120}
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                maxLength={2000}
              />
            </label>

            <div className="row">
              <label>
                Level
                <input
                  value={editing.level}
                  onChange={(e) => setEditing({ ...editing, level: e.target.value })}
                  placeholder="Beginner"
                />
              </label>
              <label>
                Ages
                <input
                  value={editing.ageRange}
                  onChange={(e) => setEditing({ ...editing, ageRange: e.target.value })}
                  placeholder="8-12"
                />
              </label>
            </div>

            <div className="row">
              <label>
                Price (₦)
                <input
                  value={editing.priceNaira}
                  onChange={(e) => setEditing({ ...editing, priceNaira: e.target.value })}
                  inputMode="decimal"
                />
              </label>
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Course["status"] })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label>
                Order
                <input
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) =>
                    setEditing({ ...editing, sortOrder: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.requiresSubscription}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    requiresSubscription: e.target.checked,
                    // Mutually exclusive: program-only content is unlocked by
                    // the program, so a membership gate on top can never be
                    // satisfied and the course becomes unreachable.
                    programOnly: e.target.checked ? false : editing.programOnly,
                  })
                }
              />
              Requires a membership
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.programOnly}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    programOnly: e.target.checked,
                    requiresSubscription: e.target.checked
                      ? false
                      : editing.requiresSubscription,
                  })
                }
              />
              Program only — hidden from the public catalogue
            </label>

            <div className="modal__actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
