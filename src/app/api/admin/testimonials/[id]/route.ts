/**
 * Admin testimonial: PUT (save) / DELETE
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { saveTestimonial, deleteTestimonial } from "@/server/content/content";
import { testimonialSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, testimonialSchema);
  const testimonial = await saveTestimonial(body, id);
  return { testimonial: { id: testimonial.id, status: testimonial.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteTestimonial(id);
  return { ok: true };
});
