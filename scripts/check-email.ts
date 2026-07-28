/**
 * Verifies the email provider actually works, and optionally sends a test.
 *
 *   npx tsx scripts/check-email.ts              # check credentials only
 *   npx tsx scripts/check-email.ts you@mail.com # check, then send there
 *
 * Worth having as a script because a mail misconfiguration is invisible until a
 * real parent fails to receive a verification link — by which point they have
 * already given up on signing up.
 */
import "dotenv/config";

import { activeProvider, verifyTransport, deliver } from "@/server/email/transport";

async function main() {
  const provider = activeProvider();
  if (!provider) {
    console.error("✖ No email provider configured.");
    console.error("  Set RESEND_API_KEY (preferred), or SMTP_HOST + SMTP_USER + SMTP_PASS.");
    process.exit(1);
  }

  console.log(`provider: ${provider}`);
  console.log(`from:     ${process.env.SMTP_FROM}`);

  const { ok, detail } = await verifyTransport();
  console.log(`${ok ? "✔" : "✖"} ${detail}`);
  if (!ok) process.exit(1);

  const to = process.argv[2];
  if (!to) {
    console.log("(pass an address to also send a test message)");
    return;
  }

  const id = await deliver({
    to,
    subject: "CodeEarly 2.0 — test email",
    text: "If you can read this, CodeEarly 2.0 can send email.\n\nCodeEarly Club",
    html: "<p>If you can read this, <b>CodeEarly 2.0</b> can send email.</p><p>CodeEarly Club</p>",
  });
  console.log(`✔ sent to ${to} (${id})`);
}

main().catch((err) => {
  console.error("✖ email check failed:", err?.message ?? err);
  process.exit(1);
});
