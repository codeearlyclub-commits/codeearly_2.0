/**
 * Course detail page.
 *
 * `getPublicCourse` throws our AppError for anything unpublished or
 * program-only. That is right for an API but wrong for a page — an unknown slug
 * should be a 404, not a 500 — so it is translated to Next's notFound() here.
 * Doing it at the edge keeps the service honest for every other caller.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicCourse } from "@/server/courses/catalog";
import { formatPrice } from "@/lib/money";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  try {
    return await getPublicCourse(slug);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await load((await params).slug);
  if (!course) return { title: "Course not found" };
  return {
    title: course.title,
    description:
      course.description ??
      `${course.title} — a coding course for children at CodeEarly Club.`,
  };
}

export default async function CoursePage({ params }: Props) {
  const course = await load((await params).slug);
  if (!course) notFound();

  return (
    <>
      <section className="x-head">
        <div className="x-wrap">
          <p className="x-crumb">
            <Link href="/courses">← All courses</Link>
          </p>
          {course.level && <span className="tag">{course.level}</span>}
          <h1>{course.title}</h1>
          {course.description && <p>{course.description}</p>}
        </div>
      </section>

      <section className="x-sec">
        <div className="x-wrap x-detail">
          <div className="x-prose">
            <h2>What your child will learn</h2>
            <p>
              This course is taught step by step, with a project at the end that
              your child builds themselves and can show you. Lessons are short
              enough to hold attention and are designed to be repeated — going
              back over a lesson is normal, not failure.
            </p>

            <h2>How it works</h2>
            <p>
              Once enrolled, your child works through the course in their own
              time using their own student sign-in. You can see their progress
              from your parent portal at any time.
            </p>
          </div>

          <aside className="x-aside">
            <div className="x-card">
              <p className="x-price">
                {course.requiresSubscription ? "Members only" : formatPrice(course.priceKobo)}
              </p>
              <dl className="x-facts">
                {course.ageRange && (
                  <div>
                    <dt>Ages</dt>
                    <dd>{course.ageRange}</dd>
                  </div>
                )}
                {course.level && (
                  <div>
                    <dt>Level</dt>
                    <dd>{course.level}</dd>
                  </div>
                )}
              </dl>

              <Link href="/register" className="btn-primary">
                {course.requiresSubscription ? "Join the club" : "Enrol your child"}
              </Link>
              <p className="x-note">
                Already a member? <Link href="/login">Sign in</Link> to enrol from
                your portal.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
