/**
 * Programs — V4's design, live data.
 *
 * Seat counts appear only where a capacity actually exists. A permanent "few
 * seats left" on an uncapped program is the kind of small dishonesty parents
 * notice, and it devalues the message when a program genuinely is nearly full.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicPrograms } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";
import { CtaBanner } from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Holiday coding programs and bootcamps for children — live classes, small cohorts, real projects.",
};

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ProgramsPage() {
  const programs = await listPublicPrograms();

  return (
    <>
      <div className="page-hero events-hero">
        <div className="page-hero-grid" />
        <div
          className="page-hero-blob"
          style={{ width: 400, height: 400, background: "rgba(0,200,150,0.1)", top: -80, right: -60 }}
        />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">Programs</div>
          <h1>
            Where learning
            <br />
            becomes <span className="accent">community.</span>
          </h1>
          <p>
            Holiday bootcamps and term-time cohorts with live classes, a small
            group, and a real project to finish and show off.
          </p>
        </div>
      </div>

      <section className="courses fade-up visible">
        {programs.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>
            No programs are open right now. <Link href="/register">Join the club</Link>{" "}
            and we&apos;ll let you know as soon as the next one opens.
          </p>
        ) : (
          <div className="event-grid site-card-grid">
            {programs.map((program) => {
              const left =
                program.capacity === null
                  ? null
                  : Math.max(0, program.capacity - program._count.enrollments);
              const closed =
                program.registrationDeadline !== null &&
                program.registrationDeadline < new Date();

              return (
                <article className="event-card" key={program.id}>
                  <div className="event-date">
                    {program.startDate ? dateFmt.format(program.startDate).split(" ")[0] : "🗓"}
                  </div>
                  <div className="event-info">
                    <h3>{program.title}</h3>
                    {program.description && <p>{program.description}</p>}
                    <div className="event-meta">
                      {program.startDate && <span>📅 {dateFmt.format(program.startDate)}</span>}
                      {program.ageRange && <span>🧒 Ages {program.ageRange}</span>}
                      {program.location && <span>💻 {program.location}</span>}
                      <span>{formatPrice(program.priceKobo)}</span>
                      <span>
                        {closed
                          ? "Registration closed"
                          : left === null
                            ? "Open for registration"
                            : left === 0
                              ? "Fully booked"
                              : `${left} seat${left === 1 ? "" : "s"} left`}
                      </span>
                    </div>
                    <p style={{ marginTop: 16 }}>
                      <Link className="btn-navy" href={`/programs/${program.id}`}>
                        {closed || left === 0 ? "View program" : "See the program →"}
                      </Link>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CtaBanner />
    </>
  );
}
