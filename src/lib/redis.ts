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
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/** Connection config BullMQ expects (blocking ops require null retries). */
export const bullConnection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  maxRetriesPerRequest: null as null,
};
