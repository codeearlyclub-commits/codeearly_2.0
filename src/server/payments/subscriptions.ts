/**
 * Member subscriptions (parents paying for a child's ongoing access).
 *
 * Distinct from an organisation's quiz plan, which lives in
 * src/server/orgs/plans.ts. Both are rows in the same Subscription table, which
 * is why the database enforces that exactly one of parentId/organizationId is
 * set — the two must never be confused for one another.
 */
import type { Subscription } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ActivateSubscriptionInput = {
  parentId: string;
  /** null = family scope, covering every child on the account. */
  childId?: string | null;
  planName: string;
  durationMonths: number;
  priceKobo: number;
  paystackReference?: string | null;
};

/**
 * Start or extend a member subscription.
 *
 * A renewal extends from the existing end date rather than from today, so a
 * parent who renews early does not forfeit the days they already paid for.
 */
export async function activateSubscription(
  input: ActivateSubscriptionInput
): Promise<Subscription> {
  if (input.durationMonths < 1) {
    throw errors.validation("A subscription must run for at least one month.");
  }

  const now = new Date();
  const existing = await prisma.subscription.findFirst({
    where: {
      parentId: input.parentId,
      childId: input.childId ?? null,
      status: "active",
      endDate: { gt: now },
    },
    orderBy: { endDate: "desc" },
  });

  const from = existing?.endDate ?? now;
  const endDate = new Date(from);
  endDate.setMonth(endDate.getMonth() + input.durationMonths);

  const subscription = await prisma.subscription.create({
    data: {
      parentId: input.parentId,
      childId: input.childId ?? null,
      planName: input.planName,
      scope: input.childId ? "per_child" : "family",
      durationMonths: input.durationMonths,
      priceKobo: input.priceKobo,
      paystackReference: input.paystackReference ?? null,
      status: "active",
      startDate: now,
      endDate,
    },
  });

  logger.info(
    { parentId: input.parentId, childId: input.childId, endDate },
    "subscription activated"
  );
  return subscription;
}

/**
 * Is this child covered right now?
 *
 * A family-scope subscription (childId null) covers every child on the account,
 * so the check has to consider both — asking only about the specific child
 * would wrongly lock out a family plan holder.
 */
export async function hasActiveSubscription(
  parentId: string,
  childId?: string,
  now = new Date()
): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: {
      parentId,
      status: "active",
      endDate: { gt: now },
      OR: [{ childId: null }, ...(childId ? [{ childId }] : [])],
    },
  });
  return count > 0;
}

/**
 * Mark ended member subscriptions expired. Run from the `reminders` queue.
 *
 * Like org plans, this removes access to new paid content but never deletes
 * anything the family already has.
 */
export async function expireEndedSubscriptions(now = new Date()): Promise<number> {
  const result = await prisma.subscription.updateMany({
    where: { parentId: { not: null }, status: "active", endDate: { lt: now } },
    data: { status: "expired" },
  });
  if (result.count > 0) logger.info({ count: result.count }, "subscriptions expired");
  return result.count;
}
