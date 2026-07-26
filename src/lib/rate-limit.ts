/**
 * Distributed rate limiting on Redis.
 *
 * V4's limiter lived in a single process's memory, which meant it reset on every
 * deploy and counted separately per instance — effectively no limit at all once
 * there was more than one lambda. This one is a sliding-window log in Redis, so
 * the count is shared by every app container and survives restarts.
 *
 * Sliding window (a sorted set of request timestamps) rather than a fixed
 * window, because a fixed window lets someone spend their whole budget at
 * 11:59:59 and the next window's at 12:00:00 — double the intended burst.
 */
import { redis } from "@/lib/redis";
import { errors } from "@/lib/errors";

export type RateLimitResult = {
  allowed: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Epoch ms when the oldest request ages out and capacity returns. */
  resetAt: number;
};

/**
 * Consume one unit against `key`.
 *
 * Fails **open** on a Redis outage: if the limiter is down, we would rather
 * serve traffic than take the whole site offline. The tradeoff is explicit —
 * for anything where failing open is unacceptable (payment mutations), check
 * the return value of `redisHealthy` alongside this.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;
  const redisKey = `rl:${key}`;

  try {
    const results = await redis
      .multi()
      .zremrangebyscore(redisKey, 0, cutoff) // drop entries that aged out
      .zadd(redisKey, now, `${now}-${Math.random()}`) // record this attempt
      .zcard(redisKey) // how many in the window now
      .pexpire(redisKey, windowMs) // let the key self-clean
      .exec();

    const count = Number(results?.[2]?.[1] ?? 0);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  } catch {
    return { allowed: true, remaining: limit, resetAt: now + windowMs };
  }
}

/** Same as `rateLimit`, but throws the 429 AppError instead of returning a flag. */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  message?: string
): Promise<void> {
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw errors.rateLimited(message);
}

/**
 * Named limits, kept in one place so they are reviewable rather than scattered
 * as magic numbers. Tuned for children on shared school wifi — generous enough
 * not to lock out a classroom behind one NAT, tight enough to stop scripted
 * abuse of the endpoints that cost money or leak identity.
 */
export const LIMITS = {
  /** Sign-in attempts per email. */
  login: { limit: 10, window: 15 * 60 },
  /** Account creation per IP. */
  signup: { limit: 5, window: 60 * 60 },
  /** Password reset requests per email. */
  passwordReset: { limit: 3, window: 60 * 60 },
  /** Join-code lookups per IP — the enumeration defence for public rooms. */
  joinCodeAttempt: { limit: 20, window: 5 * 60 },
  /** Answer submissions per participant — stops a scripted client spamming. */
  quizAnswer: { limit: 120, window: 60 },
  /** Payment initialisations per user. */
  paymentInit: { limit: 10, window: 10 * 60 },
  /** Public form posts (contact, newsletter) per IP. */
  publicForm: { limit: 5, window: 10 * 60 },
} as const;
