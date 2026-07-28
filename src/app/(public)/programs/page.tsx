/**
 * Programs — cohort offerings like the holiday Bootcamp.
 *
 * Seat counts are shown only where a capacity actually exists. A permanent
 * "few seats left" on an uncapped program is the kind of small dishonesty
 * parents notice and remember.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicPrograms } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = {
  title: "Programs",
  description:
    "Holiday coding programs and bootcamps for children — live classes, small cohorts, real projects.",
};

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function ProgramsPage() {
  const programs = await listPublicPrograms();

  return (
    <>
      <section className="page-head">
        <div className="container">
          <h1>Programs</h1>
          <p>
            Holiday bootcamps and term-time cohorts with live classes, a small
            group, and a real project to finish and show off.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {programs.length === 0 ? (
            <p className="muted">
              No programs are open right now.{" "}
              <Link href="/register">Join the club</Link> and we&apos;ll let you
              know as soon as the next one opens.
            </p>
          ) : (
            <div className="grid grid--2">
              {programs.map((program) => {
                const left =
                  program.capacity === null
                    ? null
                    : Math.max(0, program.capacity - program._count.enrollments);
                const closed =
                  program.registrationDeadline !== null &&
                  program.registrationDeadline < new Date();

                return (
                  <Link
                    key={program.id}
                    href={`/programs/${program.id}`}
                    className="card card--wide"
                  >
                    <div className="card__body">
                      <span className="tag tag--warm">{program.type}</span>
                      <h3>{program.title}</h3>
                      {program.description && <p>{program.description}</p>}

                      <dl className="facts">
                        {program.startDate && (
                          <div>
                            <dt>Starts</dt>
                            <dd>{dateFmt.format(program.startDate)}</dd>
                          </div>
                        )}
                        {program.ageRange && (
                          <div>
                            <dt>Ages</dt>
                            <dd>{program.ageRange}</dd>
                          </div>
                        )}
                        {program.location && (
                          <div>
                            <dt>Where</dt>
                            <dd>{program.location}</dd>
                          </div>
                        )}
                        {program.sessions.length > 0 && (
                          <div>
                            <dt>Sessions</dt>
                            <dd>{program.sessions.length}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div className="card__foot">
                      <span className="muted">
                        {closed
                          ? "Registration closed"
                          : left === null
                            ? "Open for registration"
                            : left === 0
                              ? "Fully booked"
                              : `${left} seat${left === 1 ? "" : "s"} left`}
                      </span>
                      <b>{formatPrice(program.priceKobo)}</b>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
