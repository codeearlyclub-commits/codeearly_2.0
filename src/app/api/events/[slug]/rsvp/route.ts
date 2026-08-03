/**
 * Event RSVP: POST /api/events/[slug]/rsvp
 *
 * Public — a parent should be able to book a free open day without creating an
 * account first. Seat claiming is atomic in the service; this route only
 * validates and rate limits.
 */
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { rsvpToEvent } from "@/server/content/content";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(80),
  email: z.string().trim().email("That email doesn't look right.").max(160),
  phone: z.string().trim().max(40).optional(),
  guests: z.number().int().min(1).max(20).optional(),
  /** Honeypot. Must parse — see the note in /api/contact for why not `.max(0)`. */
  website: z.string().max(2000).optional(),
});

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const ip = clientIp(req);

  await enforceRateLimit(
    `rsvp:${ip}`,
    LIMITS.publicForm.limit,
    LIMITS.publicForm.window,
    "You've booked a few times already — give us a moment."
  );

  const { slug } = await ctx.params;
  const body = await parseBody(req, schema);

  if (body.website) {
    logger.warn({ ip, slug }, "rsvp honeypot triggered");
    return { ok: true, alreadyBooked: false };
  }

  const { alreadyBooked } = await rsvpToEvent({
    slug,
    name: body.name,
    email: body.email,
    phone: body.phone,
    guests: body.guests ?? 1,
  });

  return { ok: true, alreadyBooked };
});
