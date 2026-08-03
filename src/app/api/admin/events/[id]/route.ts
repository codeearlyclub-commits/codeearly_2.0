/**
 * Admin event: PUT (save) / DELETE
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { saveEvent, deleteEvent } from "@/server/content/content";
import { eventSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, eventSchema);
  const event = await saveEvent(body, id);
  return { event: { id: event.id, slug: event.slug, status: event.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteEvent(id);
  return { ok: true };
});
