/**
 * Program detail page.
 *
 * Shows the real schedule and an honest availability state. A parent deciding
 * whether to book a holiday program needs the dates, the ages, and whether
 * there is actually a seat — guessing at any of those wastes their time and
 * ours.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicProgram } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function load(id: string) {
  try {
    return await getPublicProgram(id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const program = await load((await params).id);
  if (!program) return { title: "Program not found" };
  return {
    title: program.title,
    description:
      program.description ??
      `${program.title} — a coding program for children at CodeEarly Club.`,
  };
}

export default async function ProgramPage({ params }: Props) {
  const program = await load((await params).id);
  if (!program) notFound();

  const left =
    program.capacity === null
      ? null
      : Math.max(0, program.capacity - program._count.enrollments);
  const closed =
    program.registrationDeadline !== null && program.registrationDeadline < new Date();
  const bookable = !closed && left !== 0;

  return (
    <>
      <section className="x-head">
        <div className="x-wrap">
          <p className="x-crumb">
            <Link href="/programs">← All programs</Link>
          </p>
          <span className="tag">{program.type}</span>
          <h1>{program.title}</h1>
          {program.description && <p>{program.description}</p>}
        </div>
      </section>

      <section className="x-sec">
        <div className="x-wrap x-detail">
          <div className="x-prose">
            {program.sessions.length > 0 && (
              <>
                <h2>Schedule</h2>
                <ol className="x-schedule">
                  {program.sessions.map((session) => (
                    <li key={session.id}>
                      <b>{session.title}</b>
                      <span className="x-note">{dateFmt.format(session.date)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {program.courses.length > 0 && (
              <>
                <h2>Courses included</h2>
                <ul className="x-tags">
                  {program.courses.map((link) => (
                    <li key={link.id}>{link.course.title}</li>
                  ))}
                </ul>
                <p className="x-note">
                  These are unlocked for your child for the duration of the
                  program.
                </p>
              </>
            )}

            <h2>What to expect</h2>
            <p>
              Live classes in a small group, taught by a real instructor. Every
              child finishes with a project they built themselves and presents
              it on the final day — which is usually the part they remember.
            </p>
          </div>

          <aside className="x-aside">
            <div className="x-card">
              <p className="x-price">
                {formatPrice(program.priceKobo)}
                {program.regularPriceKobo !== null &&
                  program.regularPriceKobo > program.priceKobo && (
                    <span className="x-was">
                      {formatPrice(program.regularPriceKobo)}
                    </span>
                  )}
              </p>

              <dl className="x-facts">
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
                {program.registrationDeadline && (
                  <div>
                    <dt>Register by</dt>
                    <dd>{dateFmt.format(program.registrationDeadline)}</dd>
                  </div>
                )}
              </dl>

              <p className={left !== null && left <= 5 && left > 0 ? "seats-low" : "muted"}>
                {closed
                  ? "Registration has closed"
                  : left === null
                    ? "Open for registration"
                    : left === 0
                      ? "Fully booked"
                      : `${left} seat${left === 1 ? "" : "s"} left of ${program.capacity}`}
              </p>

              {bookable ? (
                <Link href="/register" className="btn-primary">
                  Register your child
                </Link>
              ) : (
                // No dead "Register" button on something nobody can join.
                <Link href="/contact" className="btn-secondary">
                  Ask about the next one
                </Link>
              )}

              <p className="x-note">
                Already a member? <Link href="/login">Sign in</Link> to register
                from your portal.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
