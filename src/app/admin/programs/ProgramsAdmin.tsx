"use client";

/**
 * Program editor, including the session schedule.
 *
 * The capacity field shows how many seats are already taken and refuses to go
 * below it in the UI as well as the API. Finding out you cannot shrink a
 * program only after pressing Save is a worse experience than being told while
 * you type.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { nairaToKobo, koboToNaira, formatPrice } from "@/lib/money";

type Session = { title: string; date: string; virtualLink: string | null };

type Program = {
  id: string;
  title: string;
  type: string;
  description: string | null;
  ageRange: string | null;
  location: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featuredOnHomepage: boolean;
  priceKobo: number;
  regularPriceKobo: number | null;
  capacity: number | null;
  seatsTaken: number;
  registered: number;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  sessions: Session[];
};

type Draft = {
  id: string;
  title: string;
  type: string;
  description: string;
  ageRange: string;
  location: string;
  status: Program["status"];
  featuredOnHomepage: boolean;
  priceNaira: string;
  regularPriceNaira: string;
  capacity: string;
  seatsTaken: number;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  sessions: Session[];
};

const BLANK: Draft = {
  id: "",
  title: "",
  type: "Holiday",
  description: "",
  ageRange: "",
  location: "",
  status: "DRAFT",
  featuredOnHomepage: false,
  priceNaira: "0",
  regularPriceNaira: "",
  capacity: "",
  seatsTaken: 0,
  startDate: "",
  endDate: "",
  registrationDeadline: "",
  sessions: [],
};

export function ProgramsAdmin({ initial }: { initial: Program[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(p: Program) {
    setError(null);
    setEditing({
      id: p.id,
      title: p.title,
      type: p.type,
      description: p.description ?? "",
      ageRange: p.ageRange ?? "",
      location: p.location ?? "",
      status: p.status,
      featuredOnHomepage: p.featuredOnHomepage,
      priceNaira: String(koboToNaira(p.priceKobo)),
      regularPriceNaira: p.regularPriceKobo ? String(koboToNaira(p.regularPriceKobo)) : "",
      capacity: p.capacity === null ? "" : String(p.capacity),
      seatsTaken: p.seatsTaken,
      startDate: p.startDate,
      endDate: p.endDate,
      registrationDeadline: p.registrationDeadline,
      sessions: p.sessions.map((s) => ({ ...s })),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);

    let priceKobo: number;
    let regularPriceKobo: number | null = null;
    try {
      priceKobo = nairaToKobo(editing.priceNaira || "0");
      if (editing.regularPriceNaira.trim()) {
        regularPriceKobo = nairaToKobo(editing.regularPriceNaira);
      }
    } catch {
      setError("Prices must be plain amounts like 7500 or 7500.50");
      return;
    }

    const capacity = editing.capacity.trim() === "" ? null : Number(editing.capacity);
    if (capacity !== null && capacity < editing.seatsTaken) {
      setError(
        `${editing.seatsTaken} already registered — capacity cannot be below ${editing.seatsTaken}.`
      );
      return;
    }

    const incomplete = editing.sessions.some((s) => !s.title.trim() || !s.date);
    if (incomplete) {
      setError("Every session needs a title and a date.");
      return;
    }

    setBusy(true);
    const res = await fetch(
      editing.id ? `/api/admin/programs/${editing.id}` : "/api/admin/programs",
      {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          type: editing.type,
          description: editing.description || null,
          ageRange: editing.ageRange || null,
          location: editing.location || null,
          status: editing.status,
          featuredOnHomepage: editing.featuredOnHomepage,
          priceKobo,
          regularPriceKobo,
          capacity,
          startDate: editing.startDate || null,
          endDate: editing.endDate || null,
          registrationDeadline: editing.registrationDeadline || null,
          sessions: editing.sessions.map((s) => ({
            title: s.title,
            date: s.date,
            virtualLink: s.virtualLink || null,
          })),
        }),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not save that program.")
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(p: Program) {
    const warning =
      p.registered > 0
        ? `${p.title} has ${p.registered} registration(s). It will be ARCHIVED rather than deleted, so those records survive. Continue?`
        : `Delete ${p.title}? Nobody is registered, so this removes it entirely.`;
    if (!confirm(warning)) return;

    setBusy(true);
    const res = await fetch(`/api/admin/programs/${p.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not remove that program.");
      return;
    }
    router.refresh();
  }

  function updateSession(i: number, patch: Partial<Session>) {
    if (!editing) return;
    const sessions = editing.sessions.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setEditing({ ...editing, sessions });
  }

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}

      <div className="admin__actions">
        <button type="button" className="btn btn--primary" onClick={() => setEditing({ ...BLANK })}>
          New program
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Status</th>
              <th>Starts</th>
              <th>Seats</th>
              <th>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No programs yet. Create your first one.
                </td>
              </tr>
            )}
            {initial.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.title}</b>
                  <br />
                  <span className="muted">
                    {p.type} · {p.sessions.length} session{p.sessions.length === 1 ? "" : "s"}
                  </span>
                  {p.featuredOnHomepage && <span className="pill">featured</span>}
                </td>
                <td>
                  <span className={`pill pill--${p.status.toLowerCase()}`}>{p.status}</span>
                </td>
                <td>{p.startDate || "—"}</td>
                <td>
                  {p.capacity === null
                    ? `${p.seatsTaken} / ∞`
                    : `${p.seatsTaken} / ${p.capacity}`}
                </td>
                <td>{formatPrice(p.priceKobo)}</td>
                <td className="table__actions">
                  <button type="button" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(p)} disabled={busy}>
                    {p.registered > 0 ? "Archive" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit program">
          <form className="modal__box" onSubmit={save}>
            <h2>{editing.id ? "Edit program" : "New program"}</h2>

            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>

            <div className="row">
              <label>
                Type
                <input
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  placeholder="Holiday"
                />
              </label>
              <label>
                Ages
                <input
                  value={editing.ageRange}
                  onChange={(e) => setEditing({ ...editing, ageRange: e.target.value })}
                  placeholder="8-14"
                />
              </label>
              <label>
                Location
                <input
                  value={editing.location}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  placeholder="Online"
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
                Regular price (₦)
                <input
                  value={editing.regularPriceNaira}
                  onChange={(e) =>
                    setEditing({ ...editing, regularPriceNaira: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder="optional"
                />
              </label>
              <label>
                Capacity
                <input
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
                  inputMode="numeric"
                  placeholder="empty = unlimited"
                />
                {editing.seatsTaken > 0 && (
                  <small className="muted">{editing.seatsTaken} already registered</small>
                )}
              </label>
            </div>

            <div className="row">
              <label>
                Starts
                <input
                  type="date"
                  value={editing.startDate}
                  onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                />
              </label>
              <label>
                Ends
                <input
                  type="date"
                  value={editing.endDate}
                  onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                />
              </label>
              <label>
                Register by
                <input
                  type="date"
                  value={editing.registrationDeadline}
                  onChange={(e) =>
                    setEditing({ ...editing, registrationDeadline: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="row">
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Program["status"] })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.featuredOnHomepage}
                onChange={(e) =>
                  setEditing({ ...editing, featuredOnHomepage: e.target.checked })
                }
              />
              Feature on the homepage
            </label>

            <fieldset className="sessions">
              <legend>Schedule</legend>
              {editing.sessions.length === 0 && (
                <p className="muted">No sessions yet.</p>
              )}
              {editing.sessions.map((session, i) => (
                <div className="row" key={i}>
                  <label>
                    Session title
                    <input
                      value={session.title}
                      onChange={(e) => updateSession(i, { title: e.target.value })}
                      placeholder="Week 1 · Getting started"
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={session.date}
                      onChange={(e) => updateSession(i, { date: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="session__remove"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        sessions: editing.sessions.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    sessions: [...editing.sessions, { title: "", date: "", virtualLink: null }],
                  })
                }
              >
                Add session
              </button>
            </fieldset>

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
