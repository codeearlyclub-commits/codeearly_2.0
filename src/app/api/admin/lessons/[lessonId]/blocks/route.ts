/**
 * Lesson blocks: GET /api/admin/lessons/:lessonId/blocks
 *
 * Fetched on demand when an author opens a lesson, rather than included in the
 * curriculum listing. A course with fifty lessons would otherwise ship every word
 * of every one of them just to render a table of titles.
 */
import { apiHandler } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ lessonId: string }> };

export const GET = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { lessonId } = await ctx.params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!lesson) throw errors.notFound("Lesson not found.");

  return {
    blocks: lesson.blocks.map((b) => ({ kind: b.kind, text: b.text, meta: b.meta })),
  };
});
