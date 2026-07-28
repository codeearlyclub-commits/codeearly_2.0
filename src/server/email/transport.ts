/**
 * Email delivery. Called only from the `email` BullMQ worker — never from a
 * request path, so a slow or failing provider cannot become a slow signup.
 *
 * Resend is the primary transport, with SMTP kept as a fallback exactly as
 * ARCHITECTURE §3 describes. Two providers is not belt-and-braces for its own
 * sake: transactional email is the single point of failure in signup, and the
 * one thing that must never happen is a parent who cannot verify their address.
 *
 * Resend is called over its REST API with `fetch` rather than the `resend` SDK.
 * The SDK is a wrapper over one HTTP POST, and on this project a dependency
 * install is measured in hours — not a trade worth making for that.
 */
import nodemailer, { type Transporter } from "nodemailer";

import { logger } from "@/lib/logger";

const RESEND_API = "https://api.resend.com/emails";

export type EmailProvider = "resend" | "smtp" | null;

/** Which transport will actually be used, in priority order. */
export function activeProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

export function isEmailConfigured(): boolean {
  return activeProvider() !== null;
}

function fromAddress(): string {
  return process.env.SMTP_FROM || "CodeEarly Club <mailer@codeearly.com>";
}

export type DeliverInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

// ── Resend ───────────────────────────────────────────────────────────────────

async function deliverViaResend(input: DeliverInput): Promise<string> {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!res.ok || !body?.id) {
    // Surface Resend's own message — the common failures are a domain that is
    // not verified yet, or a `from` address on a domain the key cannot use, and
    // both are unguessable from a generic error.
    const reason = body?.message || body?.name || `HTTP ${res.status}`;
    throw new Error(`Resend rejected the message: ${reason}`);
  }

  return body.id;
}

// ── SMTP fallback ────────────────────────────────────────────────────────────

let cachedSmtp: Transporter | null = null;

function smtpTransport(): Transporter {
  if (cachedSmtp) return cachedSmtp;

  const port = Number(process.env.SMTP_PORT || 587);
  cachedSmtp = nodemailer.createTransport({
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

  return cachedSmtp;
}

async function deliverViaSmtp(input: DeliverInput): Promise<string> {
  const info = await smtpTransport().sendMail({
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
  return info.messageId;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Deliver one message. Throws on failure so BullMQ retries with backoff —
 * a transient provider hiccup should not cost someone their verification link.
 */
export async function deliver(input: DeliverInput): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new Error("No email provider configured");

  const id =
    provider === "resend" ? await deliverViaResend(input) : await deliverViaSmtp(input);

  logger.info({ to: input.to, provider, id }, "email delivered");
  return id;
}

/**
 * Checks the provider is usable without sending anything to a real person.
 *
 * Resend has no dedicated verify endpoint, so this lists domains — which fails
 * on a bad key and, usefully, tells us whether the sending domain is verified.
 */
export async function verifyTransport(): Promise<{ ok: boolean; detail: string }> {
  const provider = activeProvider();
  if (!provider) return { ok: false, detail: "no provider configured" };

  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok) {
      return { ok: false, detail: `Resend API key rejected (HTTP ${res.status})` };
    }
    const body = (await res.json().catch(() => null)) as
      | { data?: Array<{ name: string; status: string }> }
      | null;
    const domains = body?.data ?? [];
    const verified = domains.filter((d) => d.status === "verified").map((d) => d.name);
    return {
      ok: true,
      detail: verified.length
        ? `key OK; verified domains: ${verified.join(", ")}`
        : "key OK, but NO verified domain — you can only send to your own address until one is verified",
    };
  }

  try {
    await smtpTransport().verify();
    return { ok: true, detail: "SMTP connection and credentials OK" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}
