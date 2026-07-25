import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check — pings Postgres and Redis. Used by Docker/Caddy/uptime
 * monitoring. Returns 200 only when both dependencies answer.
 */
export async function GET() {
  const checks: Record<string, "ok" | "down"> = { db: "down", redis: "down" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch { /* stays down */ }

  try {
    const pong = await redis.ping();
    if (pong === "PONG") checks.redis = "ok";
  } catch { /* stays down */ }

  const healthy = checks.db === "ok" && checks.redis === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
