/**
 * Events — V4's design, live data.
 *
 * Only upcoming published events are listed. A page of things that already
 * happened looks like a dead site, and `listPublicEvents` enforces that in the
 * service so no other caller can accidentally show them.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicEvents } from "@/server/content/content";
import { CtaBanner } from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Open days, coding challenges, showcases and live quizzes for CodeEarly Club families.",
};

export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("en-NG", { month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});

export default async function EventsPage() {
  const events = await listPublicEvents();

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-grid" />
        <div
          className="page-hero-blob"
          style={{ width: 360, height: 360, background: "rgba(155,109,255,0.09)", top: -60, right: -40 }}
        />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">What&apos;s on</div>
          <h1>
            Come and <span className="accent">build</span> with us.
          </h1>
          <p>
            Open days, holiday challenges, showcases and our Friday quizzes. Most
            are free, and everyone is welcome.
          </p>
        </div>
      </div>

      <section className="upcoming" style={{ padding: "64px 5vw" }}>
        <div className="section-eyebrow">Upcoming</div>
        <h2 className="section-title">Next up at the club</h2>

        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-title">Nothing scheduled just yet</div>
            <p>
              We run something most weeks — <Link href="/contact">tell us you&apos;re
              interested</Link> and we&apos;ll let you know first.
            </p>
          </div>
        ) : (
          <div className="up-list">
            {events.map((event) => {
              const full =
                event.capacity !== null && event.seatsTaken >= event.capacity;
              return (
                <Link className="up-item up-item-link" key={event.id} href={`/events/${event.slug}`}>
                  <div className="up-date">
                    <div className="up-month">{monthFmt.format(event.startsAt)}</div>
                    <div className="up-day">{event.startsAt.getDate()}</div>
                  </div>
                  <div className="up-info">
                    <div className="up-name">{event.title}</div>
                    <div className="up-meta">
                      {timeFmt.format(event.startsAt)}
                      {event.location ? ` · ${event.location}` : ""}
                      {event.capacity !== null
                        ? ` · ${Math.max(0, event.capacity - event.seatsTaken)} place${
                            event.capacity - event.seatsTaken === 1 ? "" : "s"
                          } left`
                        : ""}
                    </div>
                  </div>
                  <span className={full ? "up-badge ub-live" : "up-badge ub-virtual"}>
                    {full ? "Full" : event.virtualLink ? "Online" : "In person"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ padding: "0 5vw 72px" }}>
        <div className="section-eyebrow">Every week</div>
        <h2 className="section-title">The Friday Quiz</h2>
        <p style={{ maxWidth: 560, color: "var(--muted)", lineHeight: 1.75 }}>
          Live, fast and free for members. Your child joins with a code from any
          device — no download, no account needed for guests.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link className="btn-primary" href="/play">
            Join a quiz →
          </Link>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
