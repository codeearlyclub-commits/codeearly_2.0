import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In a long-lived container one instance owns one
 * connection pool for the whole process — no per-request pool explosion, no
 * serverless connection-cap problem (the core reason 2.0 leaves Vercel+Atlas).
 * The globalThis guard prevents duplicate clients during dev hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The connection pool is sized EXPLICITLY, and that is not a tuning preference.
 *
 * Prisma's default is `physical_cpus * 2 + 1`. On a machine where it detects one
 * CPU — a small VPS, a constrained container, a throttled dev box — that is a
 * pool of THREE. The homepage alone fans out four service calls in parallel and
 * several of those issue more than one query, so the fourth waits on a free
 * connection and dies at the 10-second pool timeout.
 *
 * That is exactly how it failed: `P2024 Timed out fetching a new connection from
 * the connection pool (connection limit: 3)`, and the homepage returned a 500
 * while `/api/health` — a single query — said the database was fine. A limit
 * derived from CPU count is the wrong input anyway: these connections are almost
 * entirely I/O-bound waiting on Postgres, not CPU-bound.
 *
 * Postgres defaults to 100 connections total. This process gets 20, leaving
 * ample room for the worker, the realtime server and a psql session.
 * Override with DATABASE_CONNECTION_LIMIT where the deployment needs it.
 */
function connectionUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    // Never override an explicit value — a deployment behind PgBouncer will have
    // set this deliberately, and quietly widening its pool would be wrong.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        process.env.DATABASE_CONNECTION_LIMIT ?? "20"
      );
    }
    return url.toString();
  } catch {
    // A URL Prisma understands but WHATWG-URL does not: hand it back untouched
    // rather than failing to start over a query parameter.
    return raw;
  }
}

const url = connectionUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
