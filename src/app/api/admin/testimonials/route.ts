/**
 * Admin testimonials: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllTestimonials, saveTestimonial } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const testimonialSchema = z.object({
  quote: z.string().trim().min(10).max(1200),
  author: z.string().trim().min(2).max(80),
  role: z.string().trim().max(80).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  order: z.number().int().min(0).max(999),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  return { testimonials: await listAllTestimonials() };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, testimonialSchema);
  const testimonial = await saveTestimonial(body);
  return { testimonial: { id: testimonial.id } };
});
