/**
 * Plan entitlements for the public quiz product.
 *
 * Limits are read from the **snapshot on the Organization**, never by joining
 * to QuizPlan at request time. The catalogue is admin-editable, so a price or
 * cap change must not retroactively shrink a room a customer already paid for.
 * The snapshot is refreshed only when a purchase succeeds.
 */
import type { Organization } from "@prisma/client";

import { errors } from "@/lib/errors";

export type EffectiveLimits = {
  maxPlayersPerSession: number;
  maxQuestionsPerQuiz: number;
  /** null = unlimited */
  maxSessionsPerMonth: number | null;
  allowPdfExport: boolean;
  allowCustomBranding: boolean;
};

/**
 * What an org falls back to when its paid plan lapses.
 *
 * Deliberately the free tier rather than zero: an expired subscription should
 * degrade the service, not delete access to it. Their existing quizzes and
 * results stay readable; they just cannot host a real-sized room again until
 * they renew.
 */
const LAPSED_FALLBACK: EffectiveLimits = {
  maxPlayersPerSession: 5,
  maxQuestionsPerQuiz: 10,
  maxSessionsPerMonth: 5,
  allowPdfExport: false,
  allowCustomBranding: false,
};

const UNLIMITED: EffectiveLimits = {
  maxPlayersPerSession: Number.MAX_SAFE_INTEGER,
  maxQuestionsPerQuiz: Number.MAX_SAFE_INTEGER,
  maxSessionsPerMonth: null,
  allowPdfExport: true,
  allowCustomBranding: true,
};

/** True while a paid plan is still within its term. Free plans never expire. */
export function isPlanActive(org: Organization, now = new Date()): boolean {
  return org.planExpiresAt === null || org.planExpiresAt > now;
}

/** The limits that actually apply right now. */
export function effectiveLimits(org: Organization, now = new Date()): EffectiveLimits {
  // CodeEarly's own tenant is not a customer of itself.
  if (org.type === "SYSTEM") return UNLIMITED;
  if (!isPlanActive(org, now)) return LAPSED_FALLBACK;

  return {
    maxPlayersPerSession: org.maxPlayersPerSession,
    maxQuestionsPerQuiz: org.maxQuestionsPerQuiz,
    maxSessionsPerMonth: org.maxSessionsPerMonth,
    allowPdfExport: org.allowPdfExport,
    allowCustomBranding: org.allowCustomBranding,
  };
}

/** An org under suspension keeps its data but cannot host anything. */
export function assertCanHost(org: Organization): void {
  if (org.status === "SUSPENDED") {
    throw errors.forbidden(
      "This account is suspended. Contact support to restore hosting.",
      { organizationId: org.id, reason: org.suspensionReason }
    );
  }
  // Public rooms put strangers near children — an unverified owner may not open one.
  if (org.type !== "SYSTEM" && org.verifiedAt === null) {
    throw errors.forbidden(
      "Verify your email before hosting a live quiz.",
      { organizationId: org.id }
    );
  }
}

export function assertQuestionCount(org: Organization, count: number): void {
  const { maxQuestionsPerQuiz } = effectiveLimits(org);
  if (count > maxQuestionsPerQuiz) {
    throw errors.planLimit(
      `Your plan allows ${maxQuestionsPerQuiz} questions per quiz. Upgrade to add more.`,
      { organizationId: org.id, requested: count, allowed: maxQuestionsPerQuiz }
    );
  }
}

export function assertPdfExport(org: Organization): void {
  if (!effectiveLimits(org).allowPdfExport) {
    throw errors.planLimit("Result PDFs are available on paid plans.", {
      organizationId: org.id,
    });
  }
}

export function assertCustomBranding(org: Organization): void {
  if (!effectiveLimits(org).allowCustomBranding) {
    throw errors.planLimit("Custom branding is available on the Pro plan.", {
      organizationId: org.id,
    });
  }
}

/**
 * Room capacity check, run at join time against the session's OWN snapshot
 * (`QuizSession.maxPlayers`) rather than the org's current plan — so a plan
 * that lapses mid-event cannot start ejecting children who are already playing.
 */
export function assertRoomHasSpace(
  sessionMaxPlayers: number,
  currentPlayerCount: number
): void {
  if (currentPlayerCount >= sessionMaxPlayers) {
    throw errors.planLimit(
      `This room is full (${sessionMaxPlayers} players).`,
      { max: sessionMaxPlayers, current: currentPlayerCount }
    );
  }
}
