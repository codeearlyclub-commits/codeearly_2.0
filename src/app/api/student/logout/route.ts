/**
 * Child sign-out: POST /api/student/logout
 *
 * Revokes the session server-side as well as clearing the cookie. Clearing the
 * cookie alone would leave a live token in Redis — and on a shared classroom
 * device, "log out" has to actually mean it.
 *
 * TWO CALLERS, TWO RESPONSES.
 *
 * The child's Sign out button is a plain <form> post, so that signing out works
 * even if the page's JavaScript failed — which is precisely when you want it to.
 * A form post needs a redirect; returning JSON navigates the browser to a page
 * of raw `{"ok":true}`, which is what it used to do.
 *
 * The parent sign-in form calls this with fetch() to evict a child session
 * before signing in, and wants the JSON. So the response is chosen by what the
 * caller says it accepts.
 */
import { NextResponse } from "next/server";

import {
  childTokenFromRequest,
  revokeChildSession,
  clearChildSessionCookie,
} from "@/lib/child-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = childTokenFromRequest(req);
  if (token) await revokeChildSession(token);

  // A browser navigating a form sends `Accept: text/html,…`; fetch() defaults to
  // `*/*`. Checking for html explicitly means the JSON path stays the default.
  const wantsHtml = req.headers.get("accept")?.includes("text/html") ?? false;

  const res = wantsHtml
    ? // 303 forces the follow-up to be a GET. A 302 after a POST may repeat the
      // POST, signing out a session that is already gone.
      NextResponse.redirect(new URL("/student", req.url), { status: 303 })
    : NextResponse.json({ ok: true });

  res.headers.set("Set-Cookie", clearChildSessionCookie());
  return res;
}
