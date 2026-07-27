/**
 * Activating a paid quiz plan for an organisation.
 *
 * This is the join between Phase 2 (money) and Phase 4 (the quiz product), and
 * the one rule that governs it: **entitlements are snapshotted onto the
 * Organization at purchase, never read live from the catalogue.**
 *
 * The catalogue is admin-editable. If limits were read through the relation, an
 * admin lowering the Pro player cap on a Tuesday would silently shrink every
 * Pro customer's rooms — including one mid-event. Copying the numbers at
 * purchase means a change applies to future purchases only, which is what a
 * customer reasonably expects from something they have paid for.
 */
import type { Organization } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Apply a plan to an organisation and start its term.
 *
 * `one_time` plans (event passes) expire `validityHours` after purchase;
 * recurring plans run for a month or a year. A renewal extends from the current
 * expiry when the plan is still live, so paying early never costs the customer
 * the remainder of what they already bought.
 */
export async function activateOrgPlan(
  organizationId: string,
  planKey: string,
  opts: { paystackReference?: string | null } = {}
): Promise<Organization> {
  const plan = await prisma.quizPlan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.active) {
    throw errors.notFound("That plan is not available.", { planKey });
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw errors.notFound("Organisation not found.", { organizationId });

  const now = new Date();
  const from = org.planExpiresAt && org.planExpiresAt > now ? org.planExpiresAt : now;

  let expiresAt: Date | null;
  if (plan.interval === "one_time") {
    expiresAt = new Date(from.getTime() + (plan.validityHours ?? 48) * 3_600_000);
  } else if (plan.priceKobo === 0) {
    expiresAt = null; // the free tier never lapses
  } else {
    const months = plan.interval === "year" ? 12 : 1;
    expiresAt = new Date(from);
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: {
        planKey: plan.key,
        planStartedAt: now,
        planExpiresAt: expiresAt,
        // The snapshot. Everything downstream reads these, not the catalogue.
        maxPlayersPerSession: plan.maxPlayersPerSession,
        maxQuestionsPerQuiz: plan.maxQuestionsPerQuiz,
        maxSessionsPerMonth: plan.maxSessionsPerMonth,
        allowPdfExport: plan.allowPdfExport,
        allowCustomBranding: plan.allowCustomBranding,
      },
    });

    if (plan.priceKobo > 0) {
      await tx.subscription.create({
        data: {
          organizationId,
          planName: plan.name,
          scope: "organization",
          durationMonths: plan.interval === "year" ? 12 : 1,
          priceKobo: plan.priceKobo,
          paystackReference: opts.paystackReference ?? null,
          status: "active",
          startDate: now,
          endDate: expiresAt ?? new Date(from.getTime() + 30 * 86_400_000),
        },
      });
    }

    return organization;
  });

  logger.info({ organizationId, planKey, expiresAt }, "org plan activated");
  return updated;
}

/**
 * Downgrade organisations whose paid term has ended.
 *
 * Deliberately does NOT delete anything. A lapsed customer keeps their quizzes
 * and results and simply cannot host a large room until they renew — losing
 * access to your own data because a card expired is hostile, and it is also the
 * fastest way to lose the renewal.
 */
export async function expireLapsedOrgPlans(now = new Date()): Promise<number> {
  const lapsed = await prisma.organization.findMany({
    where: { planExpiresAt: { lt: now }, planKey: { not: "free" } },
    select: { id: true },
  });
  if (lapsed.length === 0) return 0;

  const free = await prisma.quizPlan.findUnique({ where: { key: "free" } });
  if (!free) throw errors.internal("Free plan missing from catalogue — seed not run?");

  await prisma.$transaction([
    prisma.organization.updateMany({
      where: { id: { in: lapsed.map((o) => o.id) } },
      data: {
        planKey: "free",
        planExpiresAt: null,
        maxPlayersPerSession: free.maxPlayersPerSession,
        maxQuestionsPerQuiz: free.maxQuestionsPerQuiz,
        maxSessionsPerMonth: free.maxSessionsPerMonth,
        allowPdfExport: free.allowPdfExport,
        allowCustomBranding: free.allowCustomBranding,
      },
    }),
    prisma.subscription.updateMany({
      where: { organizationId: { in: lapsed.map((o) => o.id) }, status: "active" },
      data: { status: "expired" },
    }),
  ]);

  logger.info({ count: lapsed.length }, "org plans lapsed to free");
  return lapsed.length;
}
