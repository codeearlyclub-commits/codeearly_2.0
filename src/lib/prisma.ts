import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In a long-lived container one instance owns one
 * connection pool for the whole process — no per-request pool explosion, no
 * serverless connection-cap problem (the core reason 2.0 leaves Vercel+Atlas).
 * The globalThis guard prevents duplicate clients during dev hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
