/**
 * Plan entitlements — what stands between a free account and a 500-player room,
 * and what decides whether a paying customer's live event keeps working.
 */
import { describe, it, expect } from "vitest";
import type { Organization } from "@prisma/client";

import {
  isPlanActive,
  effectiveLimits,
  assertCanHost,
  assertQuestionCount,
  assertPdfExport,
  assertRoomHasSpace,
} from "@/server/orgs/entitlements";

const NOW = new Date("2026-07-01T12:00:00Z");

/**
 * The default fixture is a paying org, and must STAY one.
 *
 * `assertQuestionCount` and friends take no `now` — they read the real clock —
 * so a hard-coded expiry date turns into a test that passes until that date and
 * then fails for everyone, which is exactly what happened here. Anchoring the
 * term to the real clock keeps "this org is paid up" true tomorrow as well.
 *
 * Tests that are ABOUT expiry pass an explicit `planExpiresAt` and an explicit
 * `now`, so they stay deterministic.
 */
const WELL_INSIDE_TERM = new Date(Date.now() + 365 * 86_400_000);

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org_1",
    name: "Test School",
    slug: "test-school",
    type: "SCHOOL",
    status: "ACTIVE",
    ownerId: "user_1",
    contactEmail: null,
    logoUrl: null,
    brandColor: null,
    planKey: "pro",
    planStartedAt: new Date("2026-06-01T00:00:00Z"),
    planExpiresAt: WELL_INSIDE_TERM,
    maxPlayersPerSession: 500,
    maxQuestionsPerQuiz: 100,
    maxSessionsPerMonth: null,
    allowPdfExport: true,
    allowCustomBranding: true,
    verifiedAt: new Date("2026-06-01T00:00:00Z"),
    suspendedAt: null,
    suspensionReason: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  } as Organization;
}

describe("isPlanActive", () => {
  it("is active while inside the term", () => {
    expect(isPlanActive(org(), NOW)).toBe(true);
  });

  it("is inactive once the term has passed", () => {
    expect(isPlanActive(org({ planExpiresAt: new Date("2026-06-30T00:00:00Z") }), NOW)).toBe(false);
  });

  it("treats a null expiry as perpetual (the free tier)", () => {
    expect(isPlanActive(org({ planExpiresAt: null }), NOW)).toBe(true);
  });
});

describe("effectiveLimits", () => {
  it("uses the org's own snapshot while paid", () => {
    expect(effectiveLimits(org(), NOW).maxPlayersPerSession).toBe(500);
  });

  it("falls back to free limits when the plan lapses", () => {
    const lapsed = effectiveLimits(org({ planExpiresAt: new Date("2026-06-01") }), NOW);
    // Degraded, not revoked: they can still host a 5-player room.
    expect(lapsed.maxPlayersPerSession).toBe(5);
    expect(lapsed.allowPdfExport).toBe(false);
    expect(lapsed.allowCustomBranding).toBe(false);
  });

  it("exempts CodeEarly's own SYSTEM org from limits", () => {
    // The platform is not a customer of itself.
    const limits = effectiveLimits(org({ type: "SYSTEM", maxPlayersPerSession: 5 }), NOW);
    expect(limits.maxPlayersPerSession).toBeGreaterThan(10_000);
    expect(limits.allowPdfExport).toBe(true);
  });
});

describe("assertCanHost", () => {
  it("allows a verified, active org", () => {
    expect(() => assertCanHost(org())).not.toThrow();
  });

  it("blocks a suspended org", () => {
    expect(() => assertCanHost(org({ status: "SUSPENDED" }))).toThrow(/suspended/i);
  });

  it("blocks an unverified owner from opening a public room", () => {
    // Public rooms put strangers near children; an unverified owner may not.
    expect(() => assertCanHost(org({ verifiedAt: null }))).toThrow(/verify/i);
  });

  it("does not require verification of the SYSTEM org", () => {
    expect(() => assertCanHost(org({ type: "SYSTEM", verifiedAt: null }))).not.toThrow();
  });
});

describe("plan gates", () => {
  it("permits a question count within the plan", () => {
    expect(() => assertQuestionCount(org(), 100)).not.toThrow();
  });

  it("rejects one question over, with an upgrade-shaped error", () => {
    expect(() => assertQuestionCount(org(), 101)).toThrow(/upgrade/i);
  });

  it("blocks PDF export on a lapsed plan", () => {
    expect(() => assertPdfExport(org({ planExpiresAt: new Date("2026-01-01") }))).toThrow(/paid plans/i);
  });
});

describe("assertRoomHasSpace", () => {
  it("allows joining below capacity", () => {
    expect(() => assertRoomHasSpace(25, 24)).not.toThrow();
  });

  it("rejects the joiner that would exceed capacity", () => {
    expect(() => assertRoomHasSpace(25, 25)).toThrow(/full/i);
  });

  it("checks the session snapshot, not the org's current plan", () => {
    // A plan lapsing mid-event must not start ejecting children who are already
    // playing, so capacity is judged against the number the session started with.
    expect(() => assertRoomHasSpace(500, 300)).not.toThrow();
  });
});
