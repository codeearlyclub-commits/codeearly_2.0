/**
 * A course section: PATCH (rename) / DELETE (remove)
 *
 * Deleting a section does NOT delete its lessons — they fall back to the course
 * root. Removing a chapter heading must not destroy the lessons inside it, along
 * with every child's progress through them.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { updateSection, deleteSection } from "@/server/lms/authoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sectionId: string }> };

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(600).optional().nullable(),
});

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { sectionId } = await ctx.params;
  const body = await parseBody(req, schema);
  const section = await updateSection(sectionId, body.title, body.summary);
  return { section: { id: section.id, title: section.title } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { sectionId } = await ctx.params;
  await deleteSection(sectionId);
  return { deleted: true };
});
