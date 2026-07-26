/**
 * Platform-wide constants shared by app code, jobs, scripts and the seed.
 */

/**
 * CodeEarly's own tenant. Every quiz is owned by an Organization; the platform's
 * first-party content belongs to this seeded SYSTEM org rather than to a null
 * owner, so org-scoping is one uniform code path with no special cases.
 */
export const SYSTEM_ORG_ID = "codeearly";
export const SYSTEM_ORG_SLUG = "codeearly";

/** Plan keys in the QuizPlan catalogue. */
export const QUIZ_PLAN_KEYS = ["free", "starter", "pro", "event_pass"] as const;
export type QuizPlanKey = (typeof QUIZ_PLAN_KEYS)[number];

/**
 * Room PIN format for guest players. Digits only (kids type these on phones),
 * ambiguous-free because 0/O and 1/I never appear in a numeric code.
 */
export const JOIN_CODE_LENGTH = 6;
