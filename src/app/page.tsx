import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

async function stackStatus() {
  const out = { db: false, redis: false, users: 0 };
  try {
    out.users = await prisma.user.count();
    out.db = true;
  } catch { /* db down */ }
  try {
    out.redis = (await redis.ping()) === "PONG";
  } catch { /* redis down */ }
  return out;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      background: ok ? "#00c896" : "#ef4444", marginRight: 8,
    }} />
  );
}

export default async function Home() {
  const s = await stackStatus();
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#64748b" }}>
        Phase 0 · Foundation
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 900, margin: "8px 0 6px" }}>CodeEarly 2.0</h1>
      <p style={{ color: "#64748b", marginBottom: 32 }}>
        Next.js · PostgreSQL · Redis · Docker · Better Auth · BullMQ
      </p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px" }}>
        <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", marginBottom: 14 }}>
          Stack status
        </h2>
        <p style={{ margin: "8px 0" }}><Dot ok={s.db} /> PostgreSQL {s.db ? "connected" : "unavailable"}</p>
        <p style={{ margin: "8px 0" }}><Dot ok={s.redis} /> Redis {s.redis ? "connected" : "unavailable"}</p>
        <p style={{ margin: "8px 0", color: "#64748b", fontSize: 14 }}>
          Users in database: <strong>{s.users}</strong>
        </p>
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "#94a3b8" }}>
        Health JSON: <a href="/api/health">/api/health</a> · Auth: <code>/api/auth/*</code>
      </p>
    </main>
  );
}
