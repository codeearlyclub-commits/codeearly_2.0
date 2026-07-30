/**
 * Course catalogue — V4's design, live data.
 *
 * Uses `listPublicCourses`, the narrowest view we have: published only, never
 * program-only. That restriction lives in the service rather than this page, so a
 * future page cannot forget it.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCourses } from "@/server/courses/catalog";
import { formatPrice } from "@/lib/money";
import { CourseGrid, CtaBanner, type CardItem } from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "Coding courses for children — Scratch, web design, JavaScript, Python and AI, grouped by age and level.",
};

export const dynamic = "force-dynamic";

const courseIcons = ["🐱", "🌐", "🎨", "💡", "⚡", "🐍", "🤖", "🎮", "📱"];

export default async function CoursesPage() {
  const courses = await listPublicCourses();

  const items: CardItem[] = courses.map((course, i) => ({
    title: course.title,
    description: course.description ?? undefined,
    icon: courseIcons[i % courseIcons.length],
    tag: course.level ?? undefined,
    meta: [
      course.ageRange ? `Ages ${course.ageRange}` : null,
      course.requiresSubscription ? "Members" : formatPrice(course.priceKobo),
    ].filter(Boolean) as string[],
    href: `/courses/${course.slug}`,
  }));

  return (
    <>
      <div className="page-hero courses-hero">
        <div className="page-hero-grid" />
        <div
          className="page-hero-blob"
          style={{ width: 350, height: 350, background: "rgba(0,200,150,0.1)", top: -60, right: -40 }}
        />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">Our Courses</div>
          <h1>
            Learn what <span className="accent">matters</span>
            <br />
            in tech today.
          </h1>
          <p>
            Self-paced courses your child can work through at home, from their very
            first block of Scratch to writing real Python.
          </p>
        </div>
      </div>

      <section className="courses fade-up visible">
        {items.length === 0 ? (
          <p style={{ textAlign: "center", opacity: 0.7 }}>
            We&apos;re putting the course catalogue together — check back very soon,
            or <Link href="/contact">ask us what&apos;s coming</Link>.
          </p>
        ) : (
          <CourseGrid items={items} variant="catalog" actionLabel="View course →" />
        )}
      </section>

      <CtaBanner />
    </>
  );
}
