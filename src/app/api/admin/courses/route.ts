/**
 * Admin courses: GET (list) / POST (create)
 *
 * requireAdmin is called here even though the admin *pages* are already
 * guarded by their layout — a layout cannot protect a fetch, and this endpoint
 * is reachable directly.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllCourses, createCourse } from "@/server/courses/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every field is required rather than defaulted.
 *
 * A `.default()` here would let a partial request silently publish a course or
 * price it at zero — the two mistakes with the largest blast radius on this
 * endpoint. The admin UI always sends the whole object, so requiring it costs
 * nothing and removes the ambiguity.
 */
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

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  const courses = await listAllCourses();
  return {
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      level: c.level,
      ageRange: c.ageRange,
      status: c.status,
      priceKobo: c.priceKobo,
      requiresSubscription: c.requiresSubscription,
      programOnly: c.programOnly,
      sortOrder: c.sortOrder,
      enrolments: c._count.enrollments,
    })),
  };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, courseSchema);
  const course = await createCourse(body);
  return { course: { id: course.id, title: course.title, slug: course.slug } };
});
