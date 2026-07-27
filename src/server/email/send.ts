/**
 * Email dispatch.
 *
 * Nothing in this codebase sends email inline. Everything is enqueued, because
 * V4's fatal pattern was awaiting a provider call inside a request: a slow or
 * failing provider became a slow or failing signup, and a bounced send was lost
 * with no retry. Here the request only writes a job; the worker owns delivery,
 * retries and provider rate limits.
 */
import { emailQueue } from "@/jobs/queues";
import type { EmailJob } from "@/jobs/queues";
import { logger } from "@/lib/logger";

export type SendEmailInput = EmailJob & {
  /** Groups retries/metrics, e.g. "verify-email", "invoice-paid". */
  kind: string;
};

/**
 * Queue an email.
 *
 * Retries with exponential backoff — a provider blip should delay a welcome
 * email, not silently drop it. Jobs are kept briefly after completion so a
 * "did they get it?" question is answerable.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { kind, ...payload } = input;
  await emailQueue.add(kind, payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: false, // keep failures for inspection
  });
  logger.info({ kind, to: payload.to }, "email queued");
}

/**
 * Address emails come from. Falls back to a sane default so a missing env var
 * degrades the From line rather than crashing a signup.
 */
export function fromAddress(): string {
  return process.env.SMTP_FROM || "CodeEarly <hello@codeearly.com>";
}

// ── Templates ────────────────────────────────────────────────────────────────
// Deliberately plain and inline for now. Both HTML and text are always sent:
// a text part materially improves deliverability and is what a screen reader
// or a stripped-down mail client actually renders.

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a2e">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin-top:32px;font-size:12px;color:#6b7280">CodeEarly Club</p>
  </div>
</body></html>`;
}

export function verificationEmail(name: string, url: string): Omit<SendEmailInput, "to"> {
  const safeName = escapeHtml(name || "there");
  return {
    kind: "verify-email",
    subject: "Confirm your CodeEarly email",
    html: layout(
      `Hi ${safeName}, confirm your email`,
      `<p style="line-height:1.6">Tap the button to confirm your email and finish setting up your CodeEarly account.</p>
       <p style="margin:24px 0"><a href="${escapeAttr(url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Confirm my email</a></p>
       <p style="font-size:13px;color:#6b7280;line-height:1.6">If the button doesn't work, paste this into your browser:<br>${escapeHtml(url)}</p>
       <p style="font-size:13px;color:#6b7280">If you didn't create a CodeEarly account, you can ignore this email.</p>`
    ),
    text: `Hi ${name || "there"},\n\nConfirm your email to finish setting up your CodeEarly account:\n${url}\n\nIf you didn't create a CodeEarly account, you can ignore this email.\n\nCodeEarly Club`,
  };
}

export function passwordResetEmail(name: string, url: string): Omit<SendEmailInput, "to"> {
  const safeName = escapeHtml(name || "there");
  return {
    kind: "password-reset",
    subject: "Reset your CodeEarly password",
    html: layout(
      `Hi ${safeName}, reset your password`,
      `<p style="line-height:1.6">Tap below to choose a new password. This link expires shortly.</p>
       <p style="margin:24px 0"><a href="${escapeAttr(url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block">Choose a new password</a></p>
       <p style="font-size:13px;color:#6b7280">If you didn't ask for this, nothing has changed and you can ignore this email.</p>`
    ),
    text: `Hi ${name || "there"},\n\nReset your CodeEarly password:\n${url}\n\nIf you didn't ask for this, nothing has changed.\n\nCodeEarly Club`,
  };
}

/**
 * Student login details, sent to the PARENT — never to a child, who has no
 * email address on file and should not be sent credentials directly.
 */
export function studentLoginEmail(
  parentName: string,
  childName: string,
  loginCode: string,
  pin: string
): Omit<SendEmailInput, "to"> {
  return {
    kind: "student-login",
    subject: `${childName}'s CodeEarly sign-in details`,
    html: layout(
      `${escapeHtml(childName)}'s sign-in details`,
      `<p style="line-height:1.6">Hi ${escapeHtml(parentName || "there")}, here are the details ${escapeHtml(childName)} can use to sign in and reach their lessons and quizzes.</p>
       <table style="margin:24px 0;font-size:18px"><tr><td style="padding:6px 16px 6px 0;color:#6b7280">Code</td><td><b style="letter-spacing:2px">${escapeHtml(loginCode)}</b></td></tr>
       <tr><td style="padding:6px 16px 6px 0;color:#6b7280">PIN</td><td><b style="letter-spacing:2px">${escapeHtml(pin)}</b></td></tr></table>
       <p style="font-size:13px;color:#6b7280;line-height:1.6">Keep these safe. You can change or switch them off any time from your portal — doing so signs ${escapeHtml(childName)} out of every device straight away.</p>`
    ),
    text: `Hi ${parentName || "there"},\n\n${childName}'s CodeEarly sign-in details:\n\nCode: ${loginCode}\nPIN:  ${pin}\n\nYou can change or switch these off any time from your portal; doing so signs them out of every device straight away.\n\nCodeEarly Club`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/** URLs go into href="…", so quotes must not be able to break out of it. */
function escapeAttr(s: string): string {
  return s.replace(/"/g, "%22").replace(/</g, "%3C").replace(/>/g, "%3E");
}
