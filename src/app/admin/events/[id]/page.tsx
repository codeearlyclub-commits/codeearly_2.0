/**
 * Who is coming.
 *
 * A plain list, because the thing staff do with it is read it out at the door.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { getEventWithRsvps } from "@/server/content/content";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});
const shortFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

export default async function EventAttendeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let event;
  try {
    event = await getEventWithRsvps(id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const heads = event.rsvps.reduce((sum, r) => sum + r.guests, 0);

  return (
    <>
      <div className="admin__crumbs">
        <Link href="/admin/events">← All events</Link>
      </div>

      <header className="admin__head">
        <h1>{event.title}</h1>
        <p className="muted">{dateFmt.format(event.startsAt)}</p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__value">{event.rsvps.length}</div>
          <div className="stat__label">Bookings</div>
        </div>
        <div className="stat">
          <div className="stat__value">{heads}</div>
          <div className="stat__label">People expected</div>
        </div>
        <div className="stat">
          <div className="stat__value">
            {event.capacity === null ? "∞" : Math.max(0, event.capacity - event.seatsTaken)}
          </div>
          <div className="stat__label">Places left</div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Party</th>
              <th>Booked</th>
            </tr>
          </thead>
          <tbody>
            {event.rsvps.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nobody has booked yet.
                </td>
              </tr>
            )}
            {event.rsvps.map((rsvp) => (
              <tr key={rsvp.id}>
                <td>
                  <b>{rsvp.name}</b>
                </td>
                <td>
                  <a href={`mailto:${rsvp.email}`}>{rsvp.email}</a>
                </td>
                <td>{rsvp.phone ?? "—"}</td>
                <td>{rsvp.guests}</td>
                <td>{shortFmt.format(rsvp.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
