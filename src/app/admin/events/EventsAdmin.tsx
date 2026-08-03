"use client";

/**
 * Events editor.
 *
 * Dates are handled as `datetime-local` strings and sent as-is; the service
 * parses them in the server's timezone. That is right for us — every event is a
 * CodeEarly event in Nigeria, and asking staff to think about UTC offsets when
 * scheduling a Saturday club would invite exactly the kind of off-by-an-hour
 * mistake that puts children outside a locked door.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type EventRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  virtualLink: string | null;
  capacity: number | null;
  seatsTaken: number;
  rsvps: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  startsAtLabel: string;
};

type Draft = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  virtualLink: string;
  capacity: string;
  status: EventRow["status"];
  seatsTaken: number;
};

const BLANK: Draft = {
  id: "",
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  location: "",
  virtualLink: "",
  capacity: "",
  status: "DRAFT",
  seatsTaken: 0,
};

export function EventsAdmin({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(event: EventRow) {
    setError(null);
    setEditing({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? "",
      location: event.location ?? "",
      virtualLink: event.virtualLink ?? "",
      capacity: event.capacity === null ? "" : String(event.capacity),
      status: event.status,
      seatsTaken: event.seatsTaken,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);

    const payload = {
      title: editing.title,
      description: editing.description || null,
      startsAt: editing.startsAt,
      endsAt: editing.endsAt || null,
      location: editing.location || null,
      virtualLink: editing.virtualLink || null,
      capacity: editing.capacity ? Number(editing.capacity) : null,
      status: editing.status,
    };

    const res = await fetch(
      editing.id ? `/api/admin/events/${editing.id}` : "/api/admin/events",
      {
        method: editing.id ? "PUT" : "POST",
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
          : (body?.error?.message ?? "Could not save that event.")
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(event: EventRow) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      // The service refuses to delete an event people have booked. Show that
      // sentence rather than a generic failure — it tells staff what to do next.
      setError(body?.error?.message ?? "Could not delete that event.");
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
            setEditing({ ...BLANK });
          }}
        >
          New event
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Event</th>
              <th>When</th>
              <th>Status</th>
              <th>Booked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nothing scheduled yet.
                </td>
              </tr>
            )}
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <b>{event.title}</b>
                  <br />
                  <code className="muted">/events/{event.slug}</code>
                  {event.virtualLink && <span className="pill">online</span>}
                </td>
                <td>{event.startsAtLabel}</td>
                <td>
                  <span className={`pill pill--${event.status.toLowerCase()}`}>
                    {event.status}
                  </span>
                </td>
                <td>
                  {event.rsvps}
                  {event.capacity !== null ? ` / ${event.capacity}` : ""}
                </td>
                <td className="table__actions">
                  <Link className="table__link" href={`/admin/events/${event.id}`}>
                    Attendees
                  </Link>
                  <button type="button" onClick={() => openEdit(event)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(event)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit event">
          <form className="modal__box modal__box--wide" onSubmit={save}>
            <h2>{editing.id ? "Edit event" : "New event"}</h2>

            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
                maxLength={140}
              />
            </label>

            <label>
              Description
              <textarea
                rows={4}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                maxLength={3000}
              />
            </label>

            <div className="row">
              <label>
                Starts
                <input
                  type="datetime-local"
                  value={editing.startsAt}
                  onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })}
                  required
                />
              </label>
              <label>
                Ends
                <input
                  type="datetime-local"
                  value={editing.endsAt}
                  onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })}
                />
              </label>
            </div>

            <div className="row">
              <label>
                Location
                <input
                  value={editing.location}
                  onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                  maxLength={160}
                  placeholder="Lekki Phase 1, Lagos"
                />
              </label>
              <label>
                Joining link (online events)
                <input
                  value={editing.virtualLink}
                  onChange={(e) => setEditing({ ...editing, virtualLink: e.target.value })}
                  maxLength={600}
                  placeholder="https://meet…"
                />
              </label>
            </div>
            <p className="muted">
              The joining link is emailed to people who book. It is never shown on the
              public page.
            </p>

            <div className="row">
              <label>
                Capacity
                <input
                  type="number"
                  min={editing.seatsTaken || 1}
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
                  placeholder="Leave blank for unlimited"
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
            {editing.seatsTaken > 0 && (
              <p className="muted">
                {editing.seatsTaken} place{editing.seatsTaken === 1 ? "" : "s"} already
                taken — capacity cannot go below that.
              </p>
            )}

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
