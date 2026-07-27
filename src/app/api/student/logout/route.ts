/**
 * Child sign-out: POST /api/student/logout
 *
 * Revokes the session server-side as well as clearing the cookie. Clearing the
 * cookie alone would leave a live token in Redis — and on a shared classroom
 * device, "log out" has to actually mean it.
 */
import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api";
import {
  childTokenFromRequest,
  revokeChildSession,
  clearChildSessionCookie,
} from "@/lib/child-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  const token = childTokenFromRequest(req);
  if (token) await revokeChildSession(token);

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearChildSessionCookie());
  return res;
});
