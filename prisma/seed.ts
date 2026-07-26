/**
 * Idempotent seed — safe to run on every deploy.
 *
 * Creates the two things the platform cannot boot without:
 *   1. the QuizPlan catalogue (free tier + paid caps for the public product)
 *   2. the SYSTEM organization that owns CodeEarly's own quizzes
 *
 * Run:  npm run db:seed
 */
// Loaded explicitly: unlike the Prisma CLI, a plain tsx script does not read
// .env for us, and the app's own env loading isn't in play here.
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { SYSTEM_ORG_ID, SYSTEM_ORG_SLUG } from "../src/lib/constants";

const prisma = new PrismaClient();

/**
 * Plan catalogue. Prices are in integer kobo (₦1 = 100 kobo).
 *
 * NOTE: these amounts are placeholders pending a commercial decision — the
 * catalogue is admin-editable at runtime, so changing them later is a form
 * submission, not a deploy.
 */
const PLANS = [
  {
    key: "free",
    name: "Free",
    description: "Try the quiz engine with up to 5 players. Upgrade to host a real room.",
    priceKobo: 0,
    interval: "month",
    validityHours: null,
    maxPlayersPerSession: 5, // trial-sized on purpose — any real class needs a paid plan
    maxQuestionsPerQuiz: 10,
    maxSessionsPerMonth: 5,
    allowPdfExport: false,
    allowCustomBranding: false,
    allowGuestPlayers: true,
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For a class or a small club running quizzes regularly.",
    priceKobo: 500_000, // ₦5,000 / month
    interval: "month",
    validityHours: null,
    maxPlayersPerSession: 100,
    maxQuestionsPerQuiz: 30,
    maxSessionsPerMonth: 30,
    allowPdfExport: true,
    allowCustomBranding: false,
    allowGuestPlayers: true,
    sortOrder: 1,
  },
  {
    key: "pro",
    name: "Pro",
    description: "For schools and organisations: big rooms, own branding.",
    priceKobo: 2_000_000, // ₦20,000 / month
    interval: "month",
    validityHours: null,
    maxPlayersPerSession: 500,
    maxQuestionsPerQuiz: 100,
    maxSessionsPerMonth: null, // unlimited
    allowPdfExport: true,
    allowCustomBranding: true,
    allowGuestPlayers: true,
    sortOrder: 2,
  },
  {
    key: "event_pass",
    name: "Event Pass",
    description: "One-off event. Big room, branded, valid 48 hours.",
    priceKobo: 1_000_000, // ₦10,000 once
    interval: "one_time",
    validityHours: 48,
    maxPlayersPerSession: 300,
    maxQuestionsPerQuiz: 50,
    maxSessionsPerMonth: null,
    allowPdfExport: true,
    allowCustomBranding: true,
    allowGuestPlayers: true,
    sortOrder: 3,
  },
] as const;

async function main() {
  for (const plan of PLANS) {
    await prisma.quizPlan.upsert({
      where: { key: plan.key },
      update: plan,
      create: plan,
    });
  }
  console.log(`✔ seeded ${PLANS.length} quiz plans`);

  // CodeEarly's own tenant. Owned by nobody (ownerId null) so no user account
  // can cascade-delete the platform's own organization. SYSTEM is exempt from
  // plan limits in the entitlement checks, but carries generous values anyway
  // so any code path that reads them directly still behaves.
  await prisma.organization.upsert({
    where: { id: SYSTEM_ORG_ID },
    update: {},
    create: {
      id: SYSTEM_ORG_ID,
      name: "CodeEarly",
      slug: SYSTEM_ORG_SLUG,
      type: "SYSTEM",
      status: "ACTIVE",
      planKey: "pro",
      verifiedAt: new Date(),
      maxPlayersPerSession: 10_000,
      maxQuestionsPerQuiz: 500,
      maxSessionsPerMonth: null,
      allowPdfExport: true,
      allowCustomBranding: true,
    },
  });
  console.log(`✔ seeded SYSTEM organization "${SYSTEM_ORG_ID}"`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("✖ seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
