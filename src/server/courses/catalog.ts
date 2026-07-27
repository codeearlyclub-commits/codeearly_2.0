/**
 * Course catalogue and enrolment.
 *
 * Two access rules decide what a family can see and join, and they are
 * different questions that V4 conflated:
 *
 *   visibility — may this course appear in a list at all?
 *   entitlement — may THIS child actually open it?
 *
 * A `programOnly` course fails the first (it is not public content and must
 * never surface in a catalogue or sitemap). A subscription-gated course passes
 * visibility — parents should see what they could buy — but fails entitlement
 * until they pay. Collapsing the two is how V4 ended up both leaking
 * program-only material into the public catalogue and hiding purchasable
 * courses from the people who would have bought them.
 */
import type { Course } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { hasActiveSubscription } from "@/server/payments/subscriptions";

/**
 * Courses for the public website.
 *
 * Excludes drafts, archived courses, and anything program-only. This is the
 * only function the marketing pages should call — it is deliberately the
 * narrowest view, so a mistake elsewhere cannot leak unpublished content.
 */
export async function listPublicCourses() {
  return prisma.course.findMany({
    where: { status: "PUBLISHED", programOnly: false },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      level: true,
      ageRange: true,
      priceKobo: true,
      requiresSubscription: true,
    },
  });
}

/** A single published course by slug, for its public page. */
export async function getPublicCourse(slug: string) {
  const course = await prisma.course.findFirst({
    where: { slug, status: "PUBLISHED", programOnly: false },
  });
  if (!course) throw errors.notFound("Course not found.");
  return course;
}

export type CourseAccess =
  | { allowed: true }
  | { allowed: false; reason: "subscription" | "program" | "not-enrolled" };

/**
 * May this child open this course?
 *
 * Returns a reason rather than throwing, because the caller usually wants to
 * render an upgrade prompt — "subscribe to unlock" is a sale, whereas a bare
 * 403 is a dead end.
 */
export async function checkCourseAccess(
  childId: string,
  parentId: string,
  course: Course
): Promise<CourseAccess> {
  if (course.programOnly) {
    // Locked to the program that contains it: the child must be enrolled in a
    // program that includes this course.
    const viaProgram = await prisma.programEnrollment.findFirst({
      where: {
        childId,
        status: "active",
        program: { courses: { some: { courseId: course.id } } },
      },
      select: { id: true },
    });
    if (!viaProgram) return { allowed: false, reason: "program" };
    return { allowed: true };
  }

  if (course.requiresSubscription) {
    const subscribed = await hasActiveSubscription(parentId, childId);
    if (!subscribed) return { allowed: false, reason: "subscription" };
  }

  const enrolled = await prisma.enrollment.findUnique({
    where: { childId_courseId: { childId, courseId: course.id } },
    select: { id: true },
  });
  if (!enrolled) return { allowed: false, reason: "not-enrolled" };

  return { allowed: true };
}

/**
 * Enrol a child in a course.
 *
 * Idempotent: re-enrolling is a no-op rather than an error, because a parent
 * double-tapping "Enrol" on a slow connection should not see a failure for
 * something that already succeeded.
 */
export async function enrolChild(
  childId: string,
  parentId: string,
  courseId: string
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED") {
    throw errors.notFound("Course not found.");
  }

  // Ownership is checked here rather than trusted from the caller.
  const child = await prisma.child.findFirst({
    where: { id: childId, parentId },
    select: { id: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  if (course.programOnly) {
    throw errors.forbidden(
      "This course is part of a program and cannot be joined on its own."
    );
  }
  if (course.requiresSubscription && !(await hasActiveSubscription(parentId, childId))) {
    throw errors.planLimit("A membership is needed to join this course.");
  }

  return prisma.enrollment.upsert({
    where: { childId_courseId: { childId, courseId } },
    create: { childId, courseId },
    update: {},
  });
}

/** Courses a child is enrolled in, for their own dashboard. */
export async function listChildCourses(childId: string) {
  const enrolments = await prisma.enrollment.findMany({
    where: { childId },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: {
        select: { id: true, title: true, slug: true, level: true, ageRange: true },
      },
    },
  });
  return enrolments.map((e) => ({ ...e.course, enrolledAt: e.enrolledAt }));
}
