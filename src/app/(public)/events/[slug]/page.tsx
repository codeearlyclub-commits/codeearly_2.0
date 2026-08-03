/**
 * Event detail and booking.
 *
 * The virtual link is shown only to people who are already booked — and since
 * this page is public, that means it is not shown here at all. It goes in the
 * confirmation email instead. Printing a joining link on a public page would let
 * anyone walk into a room full of children.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicEvent } from "@/server/content/content";
import { RsvpForm } from "@/components/site/RsvpForm";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const longFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const event = await getPublicEvent(slug);
    return { title: event.title, description: event.description ?? undefined };
  } catch {
    return { title: "Event not found" };
  }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;

  let event;
  try {
    event = await getPublicEvent(slug);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const past = event.startsAt < new Date();
  const full = event.capacity !== null && event.seatsTaken >= event.capacity;
  const placesLeft = event.capacity !== null ? Math.max(0, event.capacity - event.seatsTaken) : null;

  return (
    <>
      <div className="event-detail-hero">
        <div>
          <div className="edh-breadcrumb">
            <Link href="/events">Events</Link>
            <span>/</span>
            <span>{event.title}</span>
          </div>
          <span className="edh-tag">{event.virtualLink ? "Online" : "In person"}</span>
          <h1 className="edh-title">{event.title}</h1>
          <div className="edh-meta">
            <span>
              📅 {longFmt.format(event.startsAt)} · {timeFmt.format(event.startsAt)}
              {event.endsAt ? ` – ${timeFmt.format(event.endsAt)}` : ""}
            </span>
            {event.location && <span>📍 {event.location}</span>}
            {placesLeft !== null && (
              <span>
                🎟️ {placesLeft} place{placesLeft === 1 ? "" : "s"} left of {event.capacity}
              </span>
            )}
          </div>
        </div>
        <div className="edh-image edh-image-placeholder">🎉</div>
      </div>

      <div className="event-detail-body">
        <div className="edb-main">
          <h2>About this event</h2>
          <div className="edb-description">
            {event.description ? (
              event.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)
            ) : (
              <p>Full details are on their way — book a place and we&apos;ll email them to you.</p>
            )}
          </div>

          {event.virtualLink && (
            <div className="edb-join-box">
              <strong>This one is online.</strong>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                We&apos;ll email you the joining link once you&apos;ve booked — it is not
                published on this page.
              </p>
            </div>
          )}
        </div>

        <aside className="edb-reg-card">
          {past ? (
            <div className="edb-reg-closed">
              <strong>This event has finished</strong>
              <p>
                Have a look at <Link href="/events">what&apos;s coming up next</Link>.
              </p>
            </div>
          ) : (
            <>
              <div className="edb-reg-title">Reserve a place</div>
              <p className="edb-reg-hint">
                Free to attend. We only need enough to know you&apos;re coming.
              </p>
              <RsvpForm slug={event.slug} full={full} />
            </>
          )}
        </aside>
      </div>
    </>
  );
}
