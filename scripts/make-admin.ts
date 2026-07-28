/**
 * Promote an existing account to CodeEarly staff.
 *
 *   npx tsx scripts/make-admin.ts you@codeearly.com
 *   npx tsx scripts/make-admin.ts you@codeearly.com --revoke
 *
 * Deliberately a script and not a UI. Admin is the role that can read every
 * family's data, so granting it is an operator action taken on the server, not
 * something reachable from a signed-in session — otherwise a compromised admin
 * account can mint more admins.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("usage: npx tsx scripts/make-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`✖ no account with email ${email}`);
    console.error("  They must register first — this promotes an existing account.");
    process.exit(1);
  }

  const role = revoke ? "user" : "admin";
  await prisma.user.update({ where: { id: user.id }, data: { role } });

  console.log(`✔ ${email} is now ${role === "admin" ? "an ADMIN" : "a normal user"}`);

  if (!revoke && !user.emailVerified) {
    console.log(
      "  note: their email is not verified yet, so they cannot sign in until it is."
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
