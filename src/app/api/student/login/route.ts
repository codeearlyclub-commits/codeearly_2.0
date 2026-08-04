/**
 * Child sign-in: POST /api/student/login
 *
 * Takes a parent-issued code + PIN and returns a restricted child session.
 * Deliberately separate from /api/auth/* — a child must never travel through
 * the parent authentication path, where a mistake would hand them a session
 * carrying billing and account access.
 *
 * ONE IDENTITY PER BROWSER.
 *
 * Signing a child in ENDS any parent session in the same browser. Without this
 * both cookies coexist, and the child is one typed URL away from billing — on
 * the family laptop, which is exactly where a child signs in. Observed doing
 * precisely that before this was added.
 *
 * The parent's session is revoked server-side, not merely un-cookied, so the
 * token cannot be replayed from anywhere it was captured.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { verifyStudentLogin } from "@/server/members/child-login";
import { createChildSession, childSessionCookie } from "@/lib/child-session";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  loginCode: z.string().min(6).max(6),
  pin: z.string().min(4).max(4),
});

export const POST = apiHandler(async (req) => {
  const body = await parseBody(req, schema);

  // Per-IP limit first: the per-child lockout stops one PIN being brute-forced,
  // but only this stops someone sweeping many codes from one machine.
  await enforceRateLimit(
    `student-login:${clientIp(req)}`,
    LIMITS.login.limit,
    LIMITS.login.window,
    "Too many tries. Please wait a few minutes."
  );

  const child = await verifyStudentLogin(body.loginCode, body.pin);

  // End any parent session in this browser BEFORE issuing the child one. Order
  // matters: if revocation throws we must not have already handed out a child
  // session alongside a live parent session.
  const parentCookie = await endParentSession(req);

  const { token, expiresIn } = await createChildSession({
    childId: child.id,
    parentId: child.parentId,
    membershipId: child.membershipId,
    displayName: child.childName,
  });

  // Cookie for the web portal; the token is also returned in the body so the
  // Capacitor app can store it and send it as a bearer header.
  const res = NextResponse.json({
    child: {
      id: child.id,
      name: child.childName,
      membershipId: child.membershipId,
    },
    token,
    expiresIn,
  });

  // append(), not set(): two Set-Cookie headers are needed — one clearing the
  // parent's, one setting the child's. `set` would drop the first.
  for (const cookie of parentCookie) res.headers.append("Set-Cookie", cookie);
  res.headers.append("Set-Cookie", childSessionCookie(token, expiresIn));
  return res;
});

/**
 * Revoke the parent session attached to this request, if any, and return the
 * Set-Cookie headers that clear it from the browser.
 *
 * Better Auth owns the cookie names, so the expiry headers are taken from its
 * own sign-out response rather than guessed — a hardcoded name would silently
 * stop clearing anything the day the cookie prefix changes.
 */
async function endParentSession(req: Request): Promise<string[]> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) return [];

    const signedOut = await auth.api.signOut({ headers: req.headers, asResponse: true });
    logger.info({ userId: session.user.id }, "parent session ended by a child sign-in");
    return signedOut.headers.getSetCookie();
  } catch (err) {
    // A child must still be able to sign in if this fails; but they must not do
    // so alongside a live parent session, so the request fails rather than
    // quietly leaving both.
    logger.error({ err }, "could not end the parent session during a child sign-in");
    throw err;
  }
}
