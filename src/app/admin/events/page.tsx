/**
 * Events — staff view. Past events included, newest first, because "who came to
 * the last open day?" is a question staff actually ask.
 */
import { listAllEvents } from "@/server/content/content";
import { EventsAdmin } from "./EventsAdmin";

export const dynamic = "force-dynamic";

const labelFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** What a `datetime-local` input expects: YYYY-MM-DDTHH:mm, local time. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default async function AdminEventsPage() {
  const events = await listAllEvents();

  return (
    <>
      <header className="admin__head">
        <h1>Events</h1>
        <p className="muted">
          Open days, challenges and showcases. Places are claimed atomically, so an
          event cannot be overbooked even if two people book at the same instant.
        </p>
      </header>

      <EventsAdmin
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          slug: e.slug,
          description: e.description,
          startsAt: toLocalInput(e.startsAt),
          endsAt: e.endsAt ? toLocalInput(e.endsAt) : null,
          location: e.location,
          virtualLink: e.virtualLink,
          capacity: e.capacity,
          seatsTaken: e.seatsTaken,
          rsvps: e._count.rsvps,
          status: e.status,
          startsAtLabel: labelFmt.format(e.startsAt),
        }))}
      />
    </>
  );
}
