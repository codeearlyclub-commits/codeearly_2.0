/**
 * Verifies the SMTP credentials actually work, and optionally sends a test.
 *
 *   npx tsx scripts/check-email.ts              # verify connection only
 *   npx tsx scripts/check-email.ts you@mail.com # verify, then send there
 *
 * Worth having as a script because a mail misconfiguration is invisible until a
 * real parent fails to receive a verification link — by which point they have
 * already given up on signing up.
 */
import "dotenv/config";

import { isEmailConfigured, verifyTransport, deliver } from "@/server/email/transport";

async function main() {
  if (!isEmailConfigured()) {
    console.error("✖ SMTP is not fully configured — need SMTP_HOST, SMTP_USER and SMTP_PASS");
    process.exit(1);
  }

  console.log(`host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 587}`);
  console.log(`from: ${process.env.SMTP_FROM}`);

  const ok = await verifyTransport();
  console.log(ok ? "✔ SMTP connection and credentials OK" : "✖ SMTP verification FAILED");
  if (!ok) process.exit(1);

  const to = process.argv[2];
  if (!to) {
    console.log("(pass an address to also send a test message)");
    return;
  }

  const messageId = await deliver({
    to,
    subject: "CodeEarly 2.0 — test email",
    text: "If you can read this, CodeEarly 2.0 can send email.\n\nCodeEarly Club",
    html: "<p>If you can read this, <b>CodeEarly 2.0</b> can send email.</p><p>CodeEarly Club</p>",
  });
  console.log(`✔ sent to ${to} (${messageId})`);
}

main().catch((err) => {
  console.error("✖ email check failed:", err?.message ?? err);
  process.exit(1);
});
