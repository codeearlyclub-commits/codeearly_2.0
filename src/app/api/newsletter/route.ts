/**
 * Newsletter signup: POST /api/newsletter
 *
 * Public, so it carries the same defences as the contact form: rate limit per IP
 * and a honeypot.
 *
 * The response is the same whether the address was new or already subscribed.
 * Distinguishing them would turn this into an oracle for "is this address on
 * CodeEarly's list?", which is not something a stranger should be able to ask.
 */
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { subscribeToNewsletter } from "@/server/content/content";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email("That email doesn't look right.").max(160),
  name: z.string().trim().max(80).optional(),
  /** Honeypot. Must parse — see the note in /api/contact for why not `.max(0)`. */
  website: z.string().max(2000).optional(),
});

export const POST = apiHandler(async (req) => {
  const ip = clientIp(req);

  await enforceRateLimit(
    `newsletter:${ip}`,
    LIMITS.publicForm.limit,
    LIMITS.publicForm.window,
    "That's a few sign-ups already — try again shortly."
  );

  const body = await parseBody(req, schema);

  if (body.website) {
    logger.warn({ ip }, "newsletter honeypot triggered");
    return { ok: true };
  }

  await subscribeToNewsletter(body.email, body.name);
  return { ok: true };
});
