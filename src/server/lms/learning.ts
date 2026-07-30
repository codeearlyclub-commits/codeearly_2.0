/**
 * The learner side of the LMS — what a child actually sees, and what is recorded.
 *
 * Access is checked here on every read. It is not enough for a lesson to be
 * published: the child must be enrolled in its course, and the course's own
 * entitlement rules (membership, program-only) must pass. A published lesson is
 * not a public one.
 */
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { checkCourseAccess } from "@/server/courses/catalog";
import { logActivity, checkCourseCompletion } from "@/server/lms/tracking";

/**
 * The course as a child sees it: published lessons only, with their own progress.
 *
 * Returns the ordered list plus which lesson to continue from, so the UI never
 * has to work that out and two surfaces cannot disagree about it.
 */
export async function getCourseForChild(childId: string, parentId: string, courseSlug: string) {
  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
  if (!course || course.status !== "PUBLISHED") throw errors.notFound("Course not found.");

  const access = await checkCourseAccess(childId, parentId, course);
  if (!access.allowed) {
    // The reason is carried through so the caller can prompt an upgrade or an
    // enrolment rather than showing a dead end.
    throw errors.forbidden(
      access.reason === "subscription"
        ? "A membership is needed for this course."
        : access.reason === "program"
          ? "This course is unlocked by its program."
          : "You are not enrolled in this course yet.",
      { reason: access.reason }
    );
  }

  const [sections, looseLessons, progress] = await Promise.all([
    prisma.courseSection.findMany({
      where: { courseId: course.id },
      orderBy: { order: "asc" },
      include: {
        lessons: {
          where: { published: true },
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            slug: true,
            kind: true,
            summary: true,
            estimatedMinutes: true,
            order: true,
          },
        },
      },
    }),
    prisma.lesson.findMany({
      where: { courseId: course.id, sectionId: null, published: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        kind: true,
        summary: true,
        estimatedMinutes: true,
        order: true,
      },
    }),
    prisma.lessonProgress.findMany({
      where: { childId, lesson: { courseId: course.id } },
      select: { lessonId: true, status: true, lastBlockOrder: true },
    }),
  ]);

  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

  // A single flat ordered list is what "next lesson" actually means; the section
  // grouping is presentation on top of it.
  const flat = [
    ...looseLessons,
    ...sections.flatMap((s) => s.lessons),
  ].map((lesson) => ({
    ...lesson,
    status: byLesson.get(lesson.id)?.status ?? null,
    lastBlockOrder: byLesson.get(lesson.id)?.lastBlockOrder ?? 0,
  }));

  const completed = flat.filter((l) => l.status === "COMPLETED").length;
  const continueFrom = flat.find((l) => l.status !== "COMPLETED") ?? null;

  return {
    course,
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      lessons: s.lessons.map((l) => ({
        ...l,
        status: byLesson.get(l.id)?.status ?? null,
      })),
    })),
    looseLessons: looseLessons.map((l) => ({
      ...l,
      status: byLesson.get(l.id)?.status ?? null,
    })),
    totalLessons: flat.length,
    completedLessons: completed,
    percentComplete: flat.length === 0 ? 0 : Math.round((completed / flat.length) * 100),
    continueFrom,
  };
}

/**
 * One lesson, with its blocks, plus what comes next.
 *
 * Opening a lesson records that it was started — progress is a side effect of
 * reading, not something the child has to remember to click.
 */
export async function getLessonForChild(
  childId: string,
  parentId: string,
  courseSlug: string,
  lessonSlug: string
) {
  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
  if (!course || course.status !== "PUBLISHED") throw errors.notFound("Lesson not found.");

  const access = await checkCourseAccess(childId, parentId, course);
  if (!access.allowed) throw errors.forbidden("You do not have access to this lesson.");

  const lesson = await prisma.lesson.findFirst({
    where: { courseId: course.id, slug: lessonSlug, published: true },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!lesson) throw errors.notFound("Lesson not found.");

  // Ordering is by (order, id) so two lessons sharing an order still resolve to
  // a stable next — otherwise "next" could oscillate between renders.
  const siblings = await prisma.lesson.findMany({
    where: { courseId: course.id, published: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, slug: true, title: true },
  });
  const index = siblings.findIndex((s) => s.id === lesson.id);

  const progress = await startLesson(childId, lesson.id);

  return {
    course,
    lesson,
    progress,
    previous: index > 0 ? siblings[index - 1]! : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1]! : null,
    position: index + 1,
    total: siblings.length,
  };
}

/** Record that a child opened a lesson. Idempotent. */
export async function startLesson(childId: string, lessonId: string) {
  const before = await prisma.lessonProgress.findUnique({
    where: { childId_lessonId: { childId, lessonId } },
    select: { id: true },
  });

  const progress = await prisma.lessonProgress.upsert({
    where: { childId_lessonId: { childId, lessonId } },
    create: { childId, lessonId, status: "IN_PROGRESS" },
    // Deliberately does NOT reset a completed lesson back to in-progress.
    // Re-reading something you finished is normal and must not undo the record.
    // Only the access time moves.
    update: { lastAccessAt: new Date() },
  });

  // Logged once, on genuinely first opening — not on every revisit, which would
  // bury a parent's feed in noise.
  if (!before) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, courseId: true },
    });
    await logActivity({
      childId,
      kind: "LESSON_STARTED",
      label: lesson?.title ?? "a lesson",
      courseId: lesson?.courseId,
      lessonId,
    });
  }

  return progress;
}

/** Remember how far through a lesson a child scrolled. */
export async function saveLessonPosition(childId: string, lessonId: string, blockOrder: number) {
  if (blockOrder < 0) throw errors.validation("Invalid position.");

  const existing = await prisma.lessonProgress.findUnique({
    where: { childId_lessonId: { childId, lessonId } },
  });
  if (!existing) return startLesson(childId, lessonId);

  // Only ever moves forward. A child scrolling back up must not lose their place.
  if (blockOrder <= existing.lastBlockOrder) return existing;

  return prisma.lessonProgress.update({
    where: { id: existing.id },
    data: { lastBlockOrder: blockOrder },
  });
}

/**
 * Mark a lesson complete.
 *
 * `completedAt` is set in the same statement as the status, because the database
 * requires them to agree (`lessonprogress_completed_has_timestamp`) — report
 * cards and certificates read that timestamp, so a mismatch would become a lie
 * on a document a parent keeps.
 */
export async function completeLesson(childId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, published: true },
    select: { id: true, title: true, courseId: true },
  });
  if (!lesson) throw errors.notFound("Lesson not found.");

  const existing = await prisma.lessonProgress.findUnique({
    where: { childId_lessonId: { childId, lessonId } },
  });

  // Completing twice keeps the FIRST timestamp. When they finished it is a fact,
  // not something a second click should rewrite.
  if (existing?.status === "COMPLETED") {
    return { progress: existing, courseCompleted: null };
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { childId_lessonId: { childId, lessonId } },
    create: { childId, lessonId, status: "COMPLETED", completedAt: new Date() },
    update: { status: "COMPLETED", completedAt: new Date() },
  });

  await logActivity({
    childId,
    kind: "LESSON_COMPLETED",
    label: lesson.title,
    courseId: lesson.courseId,
    lessonId,
  });

  // Returned so the UI can celebrate a finished course rather than silently
  // moving on — this is the moment worth marking for a child.
  const courseCompleted = await checkCourseCompletion(childId, lesson.courseId);

  return { progress, courseCompleted };
}

/** Every enrolled course with progress — the child's dashboard. */
export async function listChildLearning(childId: string) {
  const enrolments = await prisma.enrollment.findMany({
    where: { childId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
          _count: { select: { lessons: { where: { published: true } } } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const done = await prisma.lessonProgress.groupBy({
    by: ["lessonId"],
    where: { childId, status: "COMPLETED" },
  });
  const completedIds = new Set(done.map((d) => d.lessonId));

  const lessonsByCourse = await prisma.lesson.findMany({
    where: { published: true, courseId: { in: enrolments.map((e) => e.course.id) } },
    select: { id: true, courseId: true },
  });

  return enrolments.map((e) => {
    const lessons = lessonsByCourse.filter((l) => l.courseId === e.course.id);
    const completed = lessons.filter((l) => completedIds.has(l.id)).length;
    return {
      courseId: e.course.id,
      title: e.course.title,
      slug: e.course.slug,
      level: e.course.level,
      totalLessons: lessons.length,
      completedLessons: completed,
      percentComplete: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
    };
  });
}
