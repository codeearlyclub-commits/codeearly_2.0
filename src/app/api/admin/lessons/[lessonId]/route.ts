/**
 * A single lesson: PATCH (update) / DELETE (remove or unpublish)
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { updateLesson, removeLesson } from "@/server/lms/authoring";
import { lessonSchema } from "../../courses/[id]/curriculum/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lessonId: string }> };

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { lessonId } = await ctx.params;
  const body = await parseBody(req, lessonSchema);
  const lesson = await updateLesson(lessonId, body);
  return { lesson: { id: lesson.id, title: lesson.title, slug: lesson.slug } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { lessonId } = await ctx.params;
  // Tells the caller which happened: a lesson children have started is
  // unpublished rather than deleted, and the UI should say so.
  return removeLesson(lessonId);
});
