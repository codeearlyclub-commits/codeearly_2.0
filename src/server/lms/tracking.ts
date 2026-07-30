/**
 * Learning tracking.
 *
 * FIRST-PARTY ONLY, deliberately. There is no third-party analytics anywhere near
 * children: Apple's Kids Category and Google Play's Families policy both restrict
 * it, and it would be the wrong thing to do regardless. Everything here exists to
 * answer two questions — "what has my child been doing?" for a parent, and "what
 * goes on the report card?" — not to profile anyone.
 *
 * The activity log is append-only. History that can be quietly rewritten is not
 * a record.
 */
import type { ActivityKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Longest gap between heartbeats still counted as continuous attention. */
const MAX_HEARTBEAT_SECONDS = 120;

/**
 * Record engaged time on a lesson.
 *
 * Called from a heartbeat while the lesson is open AND focused. The increment is
 * clamped, because the failure mode otherwise is a tab left open overnight
 * reporting eight hours of study — which then appears on a report card a parent
 * reads. Time has to be defensible, not merely large.
 */
export async function recordEngagement(
  childId: string,
  lessonId: string,
  seconds: number
): Promise<void> {
  const clamped = Math.min(Math.max(0, Math.round(seconds)), MAX_HEARTBEAT_SECONDS);
  if (clamped === 0) return;

  await prisma.lessonProgress.updateMany({
    where: { childId, lessonId },
    data: {
      timeSpentSeconds: { increment: clamped },
      lastAccessAt: new Date(),
    },
  });
}

/** Append an activity entry. Never throws into the caller's path. */
export async function logActivity(input: {
  childId: string;
  kind: ActivityKind;
  label: string;
  courseId?: string | null;
  lessonId?: string | null;
}): Promise<void> {
  try {
    await prisma.learningActivity.create({
      data: {
        childId: input.childId,
        kind: input.kind,
        label: input.label,
        courseId: input.courseId ?? null,
        lessonId: input.lessonId ?? null,
      },
    });
  } catch (err) {
    // Tracking is not worth failing a lesson over. A child who finished a lesson
    // must keep their completion even if the audit row could not be written.
    logger.error({ err, childId: input.childId, kind: input.kind }, "activity log failed");
  }
}

/**
 * Check whether a course is now finished, and record it if so.
 *
 * Stored rather than derived: it is what a certificate attests to, and publishing
 * one more lesson next term must not retroactively un-complete a course a child
 * already finished — nor invalidate a certificate already in a frame.
 *
 * Returns the completion only when it was newly created, so the caller knows
 * whether to celebrate.
 */
export async function checkCourseCompletion(childId: string, courseId: string) {
  const existing = await prisma.courseCompletion.findUnique({
    where: { childId_courseId: { childId, courseId } },
  });
  if (existing) return null;

  const [published, completed, course] = await Promise.all([
    prisma.lesson.count({ where: { courseId, published: true } }),
    prisma.lessonProgress.count({
      where: { childId, status: "COMPLETED", lesson: { courseId, published: true } },
    }),
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
  ]);

  // A course with no lessons yet is not "complete" — it is empty.
  if (published === 0 || completed < published) return null;

  const completion = await prisma.courseCompletion.create({
    data: { childId, courseId, lessonCount: published },
  });

  await logActivity({
    childId,
    kind: "COURSE_COMPLETED",
    label: course?.title ?? "a course",
    courseId,
  });

  logger.info({ childId, courseId, lessonCount: published }, "course completed");
  return completion;
}

/** Recent activity for a child — the parent's feed and the child's own history. */
export async function recentActivity(childId: string, take = 20) {
  return prisma.learningActivity.findMany({
    where: { childId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, label: true, createdAt: true, courseId: true },
  });
}

/**
 * Learning summary for a child. The numbers a parent actually asks about, and
 * the ones a report card is built from.
 */
export async function learningSummary(childId: string) {
  const [progress, completions, activityCount, lastActive] = await Promise.all([
    prisma.lessonProgress.aggregate({
      where: { childId },
      _sum: { timeSpentSeconds: true },
      _count: true,
    }),
    prisma.courseCompletion.count({ where: { childId } }),
    prisma.lessonProgress.count({ where: { childId, status: "COMPLETED" } }),
    prisma.lessonProgress.findFirst({
      where: { childId },
      orderBy: { lastAccessAt: "desc" },
      select: { lastAccessAt: true },
    }),
  ]);

  return {
    lessonsStarted: progress._count,
    lessonsCompleted: activityCount,
    coursesCompleted: completions,
    totalMinutes: Math.round((progress._sum.timeSpentSeconds ?? 0) / 60),
    lastActiveAt: lastActive?.lastAccessAt ?? null,
  };
}
