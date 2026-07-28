/**
 * Contact form: POST /api/contact
 *
 * Public and unauthenticated, so it is a spam target and a potential relay for
 * abuse. Three defences: a shared Redis rate limit per IP, a honeypot field
 * bots fill in and humans never see, and strict length caps so the endpoint
 * cannot be used to pump large payloads into our inbox.
 */
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/server/email/send";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(80),
  email: z.string().trim().email("That email doesn't look right.").max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, "Please tell us a little more.").max(2000),
  /** Honeypot — hidden from humans, irresistible to naive bots. */
  website: z.string().max(0).optional(),
});

export const POST = apiHandler(async (req) => {
  await enforceRateLimit(
    `contact:${clientIp(req)}`,
    LIMITS.publicForm.limit,
    LIMITS.publicForm.window,
    "You've sent a few messages already — please give us a moment to reply."
  );

  const body = await parseBody(req, schema);

  if (body.website) {
    // Silently accept. Telling a bot it was detected only helps it adapt, and
    // a human will never see this branch.
    logger.warn({ ip: clientIp(req) }, "contact honeypot triggered");
    return { ok: true };
  }

  const to = process.env.ADMIN_EMAIL?.split(",")[0]?.trim();
  if (!to) {
    logger.error("ADMIN_EMAIL is not set — contact message would be lost");
    // Do not tell the sender it worked when it did not.
    throw new Error("Contact routing is not configured");
  }

  await sendEmail({
    to,
    kind: "contact-message",
    subject: `New enquiry from ${body.name}`,
    text: `From: ${body.name} <${body.email}>\nPhone: ${body.phone || "—"}\n\n${body.message}`,
    html:
      `<p><b>${escapeHtml(body.name)}</b> &lt;${escapeHtml(body.email)}&gt;</p>` +
      `<p>Phone: ${escapeHtml(body.phone || "—")}</p>` +
      `<hr><p>${escapeHtml(body.message).replace(/\n/g, "<br>")}</p>`,
    // Replying should go to the parent, not to ourselves.
    replyTo: body.email,
  });

  logger.info({ from: body.email }, "contact message queued");
  return { ok: true };
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
