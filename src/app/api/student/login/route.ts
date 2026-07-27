/**
 * Child sign-in: POST /api/student/login
 *
 * Takes a parent-issued code + PIN and returns a restricted child session.
 * Deliberately separate from /api/auth/* — a child must never travel through
 * the parent authentication path, where a mistake would hand them a session
 * carrying billing and account access.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { verifyStudentLogin } from "@/server/members/child-login";
import { createChildSession, childSessionCookie } from "@/lib/child-session";

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
  res.headers.set("Set-Cookie", childSessionCookie(token, expiresIn));
  return res;
});
