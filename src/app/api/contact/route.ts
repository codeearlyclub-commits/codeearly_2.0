/**
 * Contact form: POST /api/contact
 *
 * Public and unauthenticated, so it is a spam target and a potential relay for
 * abuse. Three defences: a shared Redis rate limit per IP, a honeypot field
 * bots fill in and humans never see, and strict length caps so the endpoint
 * cannot be used to pump large payloads into our inbox.
 *
 * ORDER MATTERS: the enquiry is STORED first, then emailed. V4 only emailed,
 * so a misconfigured mailbox or a failed send meant a parent's question vanished
 * with no trace anywhere. Now the record is safe before delivery is attempted,
 * and a failed notification is a logged warning rather than a lost customer.
 */
import { createHash } from "node:crypto";

import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { sendEmail } from "@/server/email/send";
import { storeMessage } from "@/server/content/content";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(80),
  email: z.string().trim().email("That email doesn't look right.").max(160),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, "Please tell us a little more.").max(2000),
  /**
   * Honeypot — hidden from humans, irresistible to naive bots.
   *
   * Deliberately NOT `.max(0)`. A zero-length rule makes the schema reject a
   * filled honeypot with a 422 that names the field, which tells the bot exactly
   * what tripped it and teaches it to leave that input alone next time. The
   * field has to parse so the handler can accept it and throw it away.
   */
  website: z.string().max(2000).optional(),
});

/**
 * Hashed, never stored raw. It exists only to recognise a repeat abuser; an
 * unhashed IP would be personal data we have no reason to hold.
 */
function hashIp(ip: string): string | null {
  if (ip === "unknown") return null;
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? "codeearly"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export const POST = apiHandler(async (req) => {
  const ip = clientIp(req);

  await enforceRateLimit(
    `contact:${ip}`,
    LIMITS.publicForm.limit,
    LIMITS.publicForm.window,
    "You've sent a few messages already — please give us a moment to reply."
  );

  const body = await parseBody(req, schema);

  if (body.website) {
    // Silently accept. Telling a bot it was detected only helps it adapt, and
    // a human will never see this branch.
    logger.warn({ ip }, "contact honeypot triggered");
    return { ok: true };
  }

  const stored = await storeMessage({
    name: body.name,
    email: body.email,
    phone: body.phone,
    message: body.message,
    ipHash: hashIp(ip),
  });

  const to = process.env.ADMIN_EMAIL?.split(",")[0]?.trim();
  if (!to) {
    // Not an error to the sender any more: the message is safely in the inbox
    // at /admin/messages, which is where staff read it.
    logger.error({ id: stored.id }, "ADMIN_EMAIL not set — enquiry stored but not emailed");
    return { ok: true };
  }

  try {
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
  } catch (err) {
    logger.error({ err, id: stored.id }, "enquiry stored but notification failed");
  }

  return { ok: true };
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
