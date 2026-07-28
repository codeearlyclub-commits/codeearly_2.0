/**
 * Admin course: PATCH (update) / DELETE (archive or remove)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { updateCourse, removeCourse } from "@/server/courses/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const courseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  level: z.string().trim().max(40).optional().nullable(),
  ageRange: z.string().trim().max(20).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  priceKobo: z.number().int().min(0),
  requiresSubscription: z.boolean(),
  programOnly: z.boolean(),
  sortOrder: z.number().int(),
});

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, courseSchema);
  const course = await updateCourse(id, body);
  return { course: { id: course.id, title: course.title, status: course.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const result = await removeCourse(id);
  // Tell the caller which happened — "deleted" and "archived because children
  // are enrolled" are different outcomes and the UI should say so.
  return result;
});
