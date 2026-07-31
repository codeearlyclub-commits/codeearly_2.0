/**
 * Curriculum: POST /api/admin/courses/:id/curriculum
 *
 * One endpoint for adding a section or a lesson, discriminated by `type`. A
 * curriculum is edited as a whole — an author adds a section, then lessons into
 * it — so keeping it to one route means the client has one place to look.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { createSection, createLesson } from "@/server/lms/authoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const blockSchema = z.object({
  kind: z.enum(["HEADING", "TEXT", "CODE", "IMAGE", "VIDEO", "CALLOUT", "LIST"]),
  text: z.string().trim().min(1).max(20_000),
  meta: z.string().trim().max(300).optional().nullable(),
});

/**
 * Shared field shape. Kept as a plain object so both the standalone lesson
 * schema and the discriminated union below can use it — `discriminatedUnion`
 * requires each branch to be a ZodObject, so an intersection (`.and()`) is not
 * an option here.
 */
const lessonFields = {
  title: z.string().trim().min(3).max(160),
  kind: z.enum(["LESSON", "PAGE", "RESOURCE", "QUIZ"]),
  summary: z.string().trim().max(600).optional().nullable(),
  sectionId: z.string().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(600).optional().nullable(),
  videoUrl: z.string().trim().max(600).optional().nullable(),
  published: z.boolean(),
  blocks: z.array(blockSchema).max(200),
};

export const lessonSchema = z.object(lessonFields);

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("section"),
    title: z.string().trim().min(2).max(160),
    summary: z.string().trim().max(600).optional().nullable(),
  }),
  z.object({ type: z.literal("lesson"), ...lessonFields }),
]);

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, schema);

  if (body.type === "section") {
    const section = await createSection(id, body.title, body.summary);
    return { section: { id: section.id, title: section.title } };
  }

  const lesson = await createLesson(id, body);
  return { lesson: { id: lesson.id, title: lesson.title, slug: lesson.slug } };
});
