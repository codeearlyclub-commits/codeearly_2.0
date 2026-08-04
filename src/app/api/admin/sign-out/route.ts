/**
 * Staff sign-out: POST /api/admin/sign-out
 *
 * A plain form post rather than a client component, so the rail needs no
 * JavaScript to sign someone out — and it still works if the page's JS failed
 * to load, which is exactly when you most want to be able to end a session.
 *
 * Returns to /staff, not /login: someone signing out of the admin is staff, and
 * sending them to the family sign-in chooser is a small daily annoyance.
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signedOut = await auth.api.signOut({ headers: req.headers, asResponse: true });

  const res = NextResponse.redirect(new URL("/staff", req.url), {
    // 303 forces the browser to follow with GET. A 302 after a POST is allowed
    // to repeat the POST, which would try to sign out again against a session
    // that no longer exists.
    status: 303,
  });
  for (const cookie of signedOut.headers.getSetCookie()) {
    res.headers.append("Set-Cookie", cookie);
  }
  return res;
}
