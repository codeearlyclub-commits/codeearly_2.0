/**
 * Structured logging (pino).
 *
 * One logger, JSON in production so a log aggregator can query it, pretty in
 * dev. Child loggers carry context — `logger.child({ orgId })` means every line
 * from that request is attributable to a tenant without threading the id
 * through every call.
 *
 * Redaction is not optional here: we handle children's names, parent emails and
 * payment references. Anything on the redact list never reaches disk.
 */
import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "guestToken",
      "*.guestToken",
      "authorization",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.secret",
      "PAYSTACK_SECRET_KEY",
      "BETTER_AUTH_SECRET",
    ],
    censor: "[redacted]",
  },
  base: { service: "codeearly" },
  // Deliberately no `transport` — a missing pretty-printer would crash the
  // process at import time. Logs are always JSON; pipe them when you want them
  // readable:  npm run dev | npx pino-pretty
});

/** Logger scoped to a tenant — use in anything org-aware. */
export function orgLogger(organizationId: string) {
  return logger.child({ organizationId });
}

/** Logger scoped to a background job run. */
export function jobLogger(queue: string, jobId?: string) {
  return logger.child({ queue, jobId });
}
