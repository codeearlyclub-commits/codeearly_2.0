import IORedis from "ioredis";

/**
 * Shared Redis connections.
 *
 * - `redis`     — general use (cache, rate limits, sessions helpers).
 * - `bullConnection` — options for BullMQ (it manages its own connections but
 *   needs maxRetriesPerRequest: null for blocking commands).
 *
 * Singletons via globalThis so dev hot-reload doesn't leak connections.
 */
const globalForRedis = globalThis as unknown as { redis?: IORedis };

export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    // Reconnect indefinitely with a capped backoff. Without a strategy ioredis
    // eventually stops trying, and every later cache or rate-limit call fails
    // for the life of the process.
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });

/**
 * An unhandled 'error' event on an ioredis client is an unhandled exception,
 * which terminates the process. A cache being briefly unreachable must never do
 * that — rate limiting fails open by design, and sessions fall back to Postgres.
 */
redis.on("error", (err: Error) => {
  console.warn("[redis] connection problem:", err.message);
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/** Connection config BullMQ expects (blocking ops require null retries). */
export const bullConnection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  maxRetriesPerRequest: null as null,
};
