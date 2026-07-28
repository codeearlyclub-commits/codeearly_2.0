/**
 * Home page.
 *
 * Written for the person who actually decides: a parent, often on a phone, on a
 * Nigerian mobile network, who has thirty seconds to work out what this is,
 * whether it suits their child's age, and what it costs. So the fold answers
 * those three questions before any decoration.
 *
 * Courses and programs are pulled live rather than hard-coded, so the homepage
 * cannot drift out of sync with the catalogue the way V4's did.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCourses } from "@/server/courses/catalog";
import { listPublicPrograms } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = {
  title: "Coding for kids",
  description:
    "CodeEarly Club teaches children 6–16 to code — live classes, self-paced courses, holiday programs and quiz competitions.",
};

// Content is admin-editable, so render per request rather than baking it in.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [courses, programs] = await Promise.all([
    listPublicCourses(),
    listPublicPrograms(),
  ]);

  const featured = courses.slice(0, 6);
  const upcoming = programs.slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <p className="eyebrow">For young coders aged 6–16</p>
          <h1>
            Your child can build
            <br />
            <span className="hero__accent">real things with code</span>
          </h1>
          <p className="hero__lead">
            Live classes, self-paced courses and holiday programs that take
            children from their first line of code to building games, websites
            and apps they are proud to show you.
          </p>
          <div className="hero__actions">
            <Link href="/register" className="btn btn--primary btn--lg">
              Join the club
            </Link>
            <Link href="/courses" className="btn btn--ghost btn--lg">
              Browse courses
            </Link>
          </div>
          <p className="hero__note">
            Free to create an account · No card needed to look around
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section__title">How it works</h2>
          <div className="grid grid--3">
            <article className="step">
              <span className="step__num" aria-hidden>
                1
              </span>
              <h3>Create your parent account</h3>
              <p>
                You hold the account and stay in control. Add each child as a
                profile — no email address needed for them.
              </p>
            </article>
            <article className="step">
              <span className="step__num" aria-hidden>
                2
              </span>
              <h3>Pick courses or a program</h3>
              <p>
                Self-paced courses they can work through at home, or a holiday
                program with live classes and a cohort of other children.
              </p>
            </article>
            <article className="step">
              <span className="step__num" aria-hidden>
                3
              </span>
              <h3>They get their own sign-in</h3>
              <p>
                Give your child a code and PIN so they can learn independently —
                lessons and quizzes only, never your billing details.
              </p>
            </article>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section section--tint">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title">Courses</h2>
              <Link href="/courses" className="link-more">
                See all courses →
              </Link>
            </div>
            <div className="grid grid--3">
              {featured.map((course) => (
                <Link key={course.id} href={`/courses/${course.slug}`} className="card">
                  <div className="card__body">
                    {course.level && <span className="tag">{course.level}</span>}
                    <h3>{course.title}</h3>
                    {course.description && <p>{course.description}</p>}
                  </div>
                  <div className="card__foot">
                    {course.ageRange && <span className="muted">Ages {course.ageRange}</span>}
                    <b>
                      {course.requiresSubscription
                        ? "Members"
                        : formatPrice(course.priceKobo)}
                    </b>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title">Upcoming programs</h2>
              <Link href="/programs" className="link-more">
                See all programs →
              </Link>
            </div>
            <div className="grid grid--3">
              {upcoming.map((program) => {
                const left =
                  program.capacity === null
                    ? null
                    : Math.max(0, program.capacity - program._count.enrollments);
                return (
                  <Link key={program.id} href={`/programs/${program.id}`} className="card">
                    <div className="card__body">
                      <span className="tag tag--warm">{program.type}</span>
                      <h3>{program.title}</h3>
                      {program.description && <p>{program.description}</p>}
                    </div>
                    <div className="card__foot">
                      {/* Scarcity only when it is true — a permanent "few seats
                          left" on a program with no cap is a lie parents notice. */}
                      <span className="muted">
                        {left === null
                          ? program.location || "Online"
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
          </div>
        </section>
      )}

      <section className="cta">
        <div className="container cta__inner">
          <h2>Ready to get started?</h2>
          <p>Create a free parent account and add your first child in a minute.</p>
          <Link href="/register" className="btn btn--primary btn--lg">
            Join the club
          </Link>
        </div>
      </section>
    </>
  );
}
