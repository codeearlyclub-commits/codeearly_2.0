/**
 * Restricted sessions for child sign-in.
 *
 * These are deliberately NOT Better Auth sessions. A Better Auth session
 * belongs to a `User` — a parent, with billing and account settings behind it.
 * A child holds no user row, and giving one a parent-shaped session would mean
 * one bug away from a nine-year-old reaching their parent's payment details.
 *
 * So: a separate token namespace, stored in Redis, carrying a scope that every
 * portal route checks. Short-lived by design — a school-day length, not a week,
 * because these are typed on shared classroom devices.
 */
import { randomBytes } from "node:crypto";

import { redis } from "@/lib/redis";

export const CHILD_SESSION_COOKIE = "ce_child_session";

/** One school day. Shared devices make long-lived child sessions a liability. */
const TTL_SECONDS = 12 * 60 * 60;

export type ChildSession = {
  childId: string;
  /** Carried so routes can scope data without a second query. */
  parentId: string;
  membershipId: string;
  displayName: string;
  /** Marks this as the restricted scope. Parent sessions never carry it. */
  scope: "child";
  createdAt: number;
};

const key = (token: string) => `childsess:${token}`;
/** Index of live tokens per child, so a parent can revoke every device at once. */
const indexKey = (childId: string) => `childsess:index:${childId}`;

export async function createChildSession(
  input: Omit<ChildSession, "scope" | "createdAt">
): Promise<{ token: string; expiresIn: number }> {
  const token = randomBytes(32).toString("base64url");
  const session: ChildSession = { ...input, scope: "child", createdAt: Date.now() };

  await redis
    .multi()
    .set(key(token), JSON.stringify(session), "EX", TTL_SECONDS)
    .sadd(indexKey(input.childId), token)
    // Index outlives the tokens slightly; stale members are pruned on read.
    .expire(indexKey(input.childId), TTL_SECONDS + 60)
    .exec();

  return { token, expiresIn: TTL_SECONDS };
}

export async function getChildSession(token: string | null | undefined) {
  if (!token) return null;
  const raw = await redis.get(key(token));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChildSession;
    // Refuse anything not explicitly child-scoped, so a token from another
    // namespace can never be replayed here.
    return parsed.scope === "child" ? parsed : null;
  } catch {
    return null;
  }
}

export async function revokeChildSession(token: string): Promise<void> {
  const session = await getChildSession(token);
  await redis.del(key(token));
  if (session) await redis.srem(indexKey(session.childId), token);
}

/**
 * Revoke every live session for a child — used when a parent regenerates or
 * disables the student login. Revocation has to be immediate: "I've turned it
 * off" must mean the device in the child's hand stops working now, not in
 * twelve hours.
 */
export async function revokeAllChildSessions(childId: string): Promise<number> {
  const tokens = await redis.smembers(indexKey(childId));
  if (tokens.length === 0) return 0;
  await redis.del(...tokens.map(key), indexKey(childId));
  return tokens.length;
}

/**
 * Read the child session token from a request — cookie on web, bearer header on
 * the Capacitor app. Same session store either way, so the portal behaves
 * identically on both.
 */
export function childTokenFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;

  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CHILD_SESSION_COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

/** Cookie attributes for the child session. */
export function childSessionCookie(token: string, maxAge = TTL_SECONDS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${CHILD_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearChildSessionCookie(): string {
  return `${CHILD_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
