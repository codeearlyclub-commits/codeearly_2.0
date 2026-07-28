/**
 * Admin course management.
 *
 * Separate from catalog.ts on purpose. That file is the *public* view and is
 * deliberately narrow — published, never program-only. This one sees
 * everything, and keeping the two apart means a public page cannot accidentally
 * import a function that returns drafts.
 */
import type { Course, PublishStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { slugify } from "@/lib/ids";

export type CourseInput = {
  title: string;
  description?: string | null;
  level?: string | null;
  ageRange?: string | null;
  status: PublishStatus;
  priceKobo: number;
  requiresSubscription: boolean;
  programOnly: boolean;
  sortOrder: number;
};

/** Every course, drafts included. Admin-only by construction. */
export async function listAllCourses() {
  return prisma.course.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    include: { _count: { select: { enrollments: true } } },
  });
}

export async function getCourse(id: string): Promise<Course> {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw errors.notFound("Course not found.");
  return course;
}

function validate(input: CourseInput) {
  if (input.title.trim().length < 3) {
    throw errors.validation("A course needs a title of at least 3 characters.");
  }
  if (!Number.isSafeInteger(input.priceKobo) || input.priceKobo < 0) {
    throw errors.validation("Price must be a whole number of kobo, zero or more.");
  }
  // Both flags set is contradictory: program-only content is unlocked by the
  // program, so a subscription gate on top of it can never be satisfied and the
  // course would be permanently unreachable.
  if (input.programOnly && input.requiresSubscription) {
    throw errors.validation(
      "A program-only course cannot also require a subscription — it would be unreachable."
    );
  }
}

/**
 * Create a course, allocating a unique slug.
 *
 * The slug is derived from the title but suffixed on collision rather than
 * rejected, because "Python for Kids" existing should not stop an admin
 * creating a second cohort's version of it.
 */
export async function createCourse(input: CourseInput): Promise<Course> {
  validate(input);

  const base = slugify(input.title) || "course";
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return await prisma.course.create({
        data: {
          slug,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          level: input.level?.trim() || null,
          ageRange: input.ageRange?.trim() || null,
          status: input.status,
          priceKobo: input.priceKobo,
          requiresSubscription: input.requiresSubscription,
          programOnly: input.programOnly,
          sortOrder: input.sortOrder,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err, "slug")) continue;
      throw err;
    }
  }
  throw errors.internal("Could not allocate a unique URL for that course.");
}

/**
 * Update a course. The slug is intentionally NOT regenerated from a new title:
 * a published course's URL may already be in a parent's browser history, a
 * WhatsApp message, or a search result, and silently changing it breaks all of
 * them for a cosmetic reason.
 */
export async function updateCourse(id: string, input: CourseInput): Promise<Course> {
  validate(input);
  await getCourse(id);

  return prisma.course.update({
    where: { id },
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      level: input.level?.trim() || null,
      ageRange: input.ageRange?.trim() || null,
      status: input.status,
      priceKobo: input.priceKobo,
      requiresSubscription: input.requiresSubscription,
      programOnly: input.programOnly,
      sortOrder: input.sortOrder,
    },
  });
}

/**
 * Archive rather than delete when anyone is enrolled.
 *
 * Deleting would cascade the enrolments away, quietly erasing the fact that a
 * child completed the course — including from any certificate that references
 * it. Archiving hides it from catalogues and keeps the history.
 */
export async function removeCourse(id: string): Promise<{ archived: boolean }> {
  const enrolled = await prisma.enrollment.count({ where: { courseId: id } });

  if (enrolled > 0) {
    await prisma.course.update({ where: { id }, data: { status: "ARCHIVED" } });
    return { archived: true };
  }

  await prisma.course.delete({ where: { id } });
  return { archived: false };
}

function isUniqueViolation(err: unknown, field: string): boolean {
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}
