/**
 * Runs once when the server starts, before any request is handled.
 *
 * Its only job right now is to force environment validation to actually
 * execute. `src/lib/env.ts` has existed since Phase 0 and was never imported by
 * anything — so the careful schema in it validated nothing, and a missing
 * BETTER_AUTH_SECRET or DATABASE_URL would surface as a confusing runtime error
 * on a user's first request instead of a loud failure at boot.
 *
 * Failing here is deliberate: a container that starts with broken config and
 * serves errors is worse than one that refuses to start and says why.
 */
export async function register() {
  // Node runtime only — the edge runtime has no access to most of these.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/env");
  const { logger } = await import("@/lib/logger");

  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      appUrl: env.APP_URL,
      payments: env.PAYSTACK_SECRET_KEY ? "configured" : "not configured",
      email: env.RESEND_API_KEY || env.SMTP_HOST ? "configured" : "not configured",
      storage: env.R2_ACCOUNT_ID ? "configured" : "not configured",
    },
    "CodeEarly starting"
  );
}
