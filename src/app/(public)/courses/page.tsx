/**
 * Course catalogue.
 *
 * Uses `listPublicCourses`, which is the narrowest view we have — published
 * only, and never program-only material. That restriction lives in the service
 * rather than in this page, so a future page cannot forget it.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCourses } from "@/server/courses/catalog";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Coding courses for children — Scratch, web design, Python, AI and more, grouped by age and level.",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublicCourses();

  return (
    <>
      <section className="page-head">
        <div className="container">
          <h1>Courses</h1>
          <p>
            Self-paced courses your child can work through at home, from their
            very first block of Scratch to writing real Python.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {courses.length === 0 ? (
            <p className="muted">
              We&apos;re putting the course catalogue together — check back very
              soon, or <Link href="/contact">ask us what&apos;s coming</Link>.
            </p>
          ) : (
            <div className="grid grid--3">
              {courses.map((course) => (
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
          )}
        </div>
      </section>
    </>
  );
}
