/**
 * Admin events: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllEvents, saveEvent } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const eventSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(3000).optional().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  location: z.string().trim().max(160).optional().nullable(),
  virtualLink: z.string().trim().max(600).optional().nullable(),
  capacity: z.number().int().min(1).max(100_000).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  const events = await listAllEvents();
  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      status: e.status,
      startsAt: e.startsAt,
      location: e.location,
      capacity: e.capacity,
      seatsTaken: e.seatsTaken,
      rsvps: e._count.rsvps,
    })),
  };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, eventSchema);
  const event = await saveEvent(body);
  return { event: { id: event.id, slug: event.slug } };
});
