/**
 * LMS authoring — the inside of a course.
 *
 * Sections and lessons are edited independently, unlike quiz questions which are
 * replaced wholesale. The reason is progress: children hold `LessonProgress` rows
 * pointing at lesson ids, so deleting and recreating a lesson on every save
 * would silently wipe the record of who had completed it. Blocks *are* replaced
 * wholesale, because nothing references a block.
 */
import type { BlockKind, Lesson, LessonKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { slugify } from "@/lib/ids";

export type BlockInput = {
  kind: BlockKind;
  text: string;
  meta?: string | null;
};

export type LessonInput = {
  title: string;
  kind: LessonKind;
  summary?: string | null;
  sectionId?: string | null;
  estimatedMinutes?: number | null;
  videoUrl?: string | null;
  published: boolean;
  blocks: BlockInput[];
};

/** The whole course tree, drafts included. Admin-only by construction. */
export async function getCourseTree(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { _count: { select: { blocks: true, progress: true } } },
          },
        },
      },
      lessons: {
        where: { sectionId: null },
        orderBy: { order: "asc" },
        include: { _count: { select: { blocks: true, progress: true } } },
      },
    },
  });
  if (!course) throw errors.notFound("Course not found.");
  return course;
}

// ── Sections ─────────────────────────────────────────────────────────────────

export async function createSection(courseId: string, title: string, summary?: string | null) {
  if (title.trim().length < 2) throw errors.validation("A section needs a title.");

  const last = await prisma.courseSection.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return prisma.courseSection.create({
    data: {
      courseId,
      title: title.trim(),
      summary: summary?.trim() || null,
      // Appended rather than inserted: a new section belongs at the end until
      // someone deliberately moves it.
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateSection(id: string, title: string, summary?: string | null) {
  if (title.trim().length < 2) throw errors.validation("A section needs a title.");
  return prisma.courseSection.update({
    where: { id },
    data: { title: title.trim(), summary: summary?.trim() || null },
  });
}

/**
 * Delete a section. Its lessons are NOT deleted — the FK is SET NULL, so they
 * fall back to the course root. Removing a chapter heading must not destroy the
 * lessons inside it, along with every child's progress through them.
 */
export async function deleteSection(id: string) {
  await prisma.courseSection.delete({ where: { id } });
}

// ── Lessons ──────────────────────────────────────────────────────────────────

function validateLesson(input: LessonInput) {
  if (input.title.trim().length < 3) {
    throw errors.validation("A lesson needs a title of at least 3 characters.");
  }
  if (
    input.estimatedMinutes != null &&
    (input.estimatedMinutes <= 0 || input.estimatedMinutes > 600)
  ) {
    throw errors.validation("Estimated minutes must be between 1 and 600.");
  }
  if (input.videoUrl && !/^https?:\/\//i.test(input.videoUrl.trim())) {
    throw errors.validation("A video URL must start with http:// or https://");
  }

  input.blocks.forEach((block, i) => {
    const where = `Block ${i + 1}`;
    if (!block.text.trim()) throw errors.validation(`${where} is empty.`);

    // IMAGE and VIDEO carry a URL in `text`; anything else is prose.
    if ((block.kind === "IMAGE" || block.kind === "VIDEO") && !/^https?:\/\//i.test(block.text.trim())) {
      throw errors.validation(`${where} needs a URL starting with http:// or https://`);
    }
    // Alt text is not optional on an image a child is meant to learn from.
    if (block.kind === "IMAGE" && !block.meta?.trim()) {
      throw errors.validation(`${where} needs alt text describing the image.`);
    }
  });

  // Publishing something empty puts a blank screen in front of a child.
  if (input.published && input.blocks.length === 0 && !input.videoUrl) {
    throw errors.validation(
      "A published lesson needs at least one block of content, or a video."
    );
  }
}

async function allocateLessonSlug(courseId: string, title: string, exceptId?: string) {
  const base = slugify(title) || "lesson";
  for (let attempt = 0; attempt < 30; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.lesson.findFirst({
      where: { courseId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
  }
  throw errors.internal("Could not allocate a unique lesson URL.");
}

export async function createLesson(courseId: string, input: LessonInput): Promise<Lesson> {
  validateLesson(input);

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw errors.notFound("Course not found.");

  const slug = await allocateLessonSlug(courseId, input.title);
  const last = await prisma.lesson.findFirst({
    where: { courseId, sectionId: input.sectionId ?? null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({
      data: {
        courseId,
        sectionId: input.sectionId ?? null,
        title: input.title.trim(),
        slug,
        kind: input.kind,
        summary: input.summary?.trim() || null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        videoUrl: input.videoUrl?.trim() || null,
        published: input.published,
        order: (last?.order ?? -1) + 1,
      },
    });

    if (input.blocks.length > 0) {
      await tx.lessonBlock.createMany({
        data: input.blocks.map((b, i) => ({
          lessonId: lesson.id,
          kind: b.kind,
          text: b.text.trim(),
          meta: b.meta?.trim() || null,
          order: i,
        })),
      });
    }

    return lesson;
  });
}

/**
 * Update a lesson in place, replacing its blocks.
 *
 * The lesson row and its id survive, so `LessonProgress` keeps pointing at it.
 * The slug is only regenerated while the lesson is UNPUBLISHED — once a child
 * may have bookmarked it, the URL stops moving.
 */
export async function updateLesson(id: string, input: LessonInput): Promise<Lesson> {
  validateLesson(input);

  const existing = await prisma.lesson.findUnique({ where: { id } });
  if (!existing) throw errors.notFound("Lesson not found.");

  const slug = existing.published
    ? existing.slug
    : await allocateLessonSlug(existing.courseId, input.title, id);

  return prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.update({
      where: { id },
      data: {
        sectionId: input.sectionId ?? null,
        title: input.title.trim(),
        slug,
        kind: input.kind,
        summary: input.summary?.trim() || null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        videoUrl: input.videoUrl?.trim() || null,
        published: input.published,
      },
    });

    // Blocks are replaced wholesale — nothing references them, and a
    // half-applied content edit is worse than a rewritten one.
    await tx.lessonBlock.deleteMany({ where: { lessonId: id } });
    if (input.blocks.length > 0) {
      await tx.lessonBlock.createMany({
        data: input.blocks.map((b, i) => ({
          lessonId: id,
          kind: b.kind,
          text: b.text.trim(),
          meta: b.meta?.trim() || null,
          order: i,
        })),
      });
    }

    return lesson;
  });
}

/**
 * Remove a lesson.
 *
 * If any child has progress on it, it is UNPUBLISHED instead of deleted.
 * Deleting would cascade the progress away — erasing the record that a child
 * completed it, which report cards and certificates depend on.
 */
export async function removeLesson(id: string): Promise<{ unpublished: boolean }> {
  const touched = await prisma.lessonProgress.count({ where: { lessonId: id } });

  if (touched > 0) {
    await prisma.lesson.update({ where: { id }, data: { published: false } });
    return { unpublished: true };
  }

  await prisma.lesson.delete({ where: { id } });
  return { unpublished: false };
}

/** Persist a new order for a set of lessons, as one transaction. */
export async function reorderLessons(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) => prisma.lesson.update({ where: { id }, data: { order: index } }))
  );
}
