/**
 * Actual email delivery. Called only from the `email` BullMQ worker — never
 * from a request path, so a slow or failing mail server cannot become a slow
 * signup.
 *
 * SMTP via nodemailer is the primary transport, because CodeEarly already owns
 * a mailbox on its own domain (mailer@codeearly.com) and mail from the domain
 * you actually own is what lands in inboxes. Resend can slot in later as a
 * higher-volume path; the queue makes swapping transports invisible to callers.
 */
import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger";

let cached: Transporter | null = null;

/** True when a transport is configured at all. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * One pooled transporter for the worker's lifetime.
 *
 * Pooling matters: the worker sends with concurrency, and opening a fresh SMTP
 * connection per message is both slow and a good way to get rate-limited by
 * your own mail host.
 */
function transporter(): Transporter {
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT || 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // `secure` means implicit TLS, which is port 465. On 587 the connection
    // starts plaintext and upgrades via STARTTLS — setting secure:true there is
    // the classic misconfiguration that hangs until timeout.
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });

  return cached;
}

export type DeliverInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Deliver one message. Throws on failure so BullMQ retries with backoff —
 * a transient mail-server hiccup should not lose a verification link.
 */
export async function deliver(input: DeliverInput): Promise<string> {
  const from = process.env.SMTP_FROM || "CodeEarly Club <mailer@codeearly.com>";

  const info = await transporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  logger.info({ to: input.to, messageId: info.messageId }, "email delivered");
  return info.messageId;
}

/** Confirms the SMTP credentials work, without sending anything. */
export async function verifyTransport(): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    await transporter().verify();
    return true;
  } catch (err) {
    logger.error({ err }, "SMTP verification failed");
    return false;
  }
}
