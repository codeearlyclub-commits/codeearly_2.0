/**
 * Lesson progress: POST /api/portal/lessons/:lessonId
 *
 * One endpoint for the three things a lesson screen reports — how far the child
 * has scrolled, engaged time, and completion. Batched because a lesson emits
 * these constantly and three endpoints would triple the chatter on a school
 * connection.
 *
 * Requires a CHILD session. A parent is not a learner: recording progress from a
 * parent's browser would credit a child with work they did not do.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireChild } from "@/lib/session";
import { completeLesson, saveLessonPosition } from "@/server/lms/learning";
import { recordEngagement } from "@/server/lms/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lessonId: string }> };

const schema = z.object({
  /** Furthest block reached. Only ever moves forward, server-side. */
  blockOrder: z.number().int().min(0).max(500).optional(),
  /** Seconds of engaged time since the last report. Clamped server-side. */
  seconds: z.number().int().min(0).max(600).optional(),
  complete: z.boolean().optional(),
});

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const child = await requireChild(req);
  const { lessonId } = await ctx.params;
  const body = await parseBody(req, schema);

  if (body.seconds) await recordEngagement(child.childId, lessonId, body.seconds);
  if (body.blockOrder !== undefined) {
    await saveLessonPosition(child.childId, lessonId, body.blockOrder);
  }

  if (body.complete) {
    const result = await completeLesson(child.childId, lessonId);
    return {
      completed: true,
      // Surfaced so the screen can celebrate a finished course rather than
      // silently moving on.
      courseCompleted: result.courseCompleted !== null,
    };
  }

  return { ok: true };
});
