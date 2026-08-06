/**
 * One identity per browser.
 *
 * Next 16 renamed this file convention from `middleware` to `proxy`; the old
 * name still runs but logs a deprecation on every boot. Same function, same
 * matcher — only the filename and the exported name changed.
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * The parent session (Better Auth cookie) and the child session (our own
 * `ce_child_session` cookie) are separate systems that knew nothing about each
 * other. So both could be set at once, and every surface was reachable
 * simultaneously: a child who signed in on the family laptop was one typed URL
 * away from billing, and from /admin if the parent was staff. Verified doing
 * exactly that before this was added.
 *
 * The child sign-in route handles its own side — it revokes the parent session
 * server-side, because it can. This covers the other direction: Better Auth owns
 * its sign-in endpoints, so the child cookie is cleared here as those responses
 * pass through.
 *
 * WHAT THIS DOES NOT DO
 *
 * This runs on the Edge runtime and cannot reach Redis, so the child's session
 * row is not revoked here — only its cookie is dropped. The orphan is httpOnly,
 * gone from the browser, and expires on its own 12-hour TTL. The sign-in form
 * additionally calls /api/student/logout, which does revoke it properly; this is
 * the backstop for every other path to the same endpoint.
 */
import { NextResponse, type NextRequest } from "next/server";

const CHILD_COOKIE = "ce_child_session";

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  if (!req.cookies.has(CHILD_COOKIE)) return res;

  res.cookies.set({
    name: CHILD_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return res;
}

// Only sign-in and sign-up. Matching all of /api/auth/* would log a child out
// whenever any page merely READ the parent session.
export const config = {
  matcher: ["/api/auth/sign-in/:path*", "/api/auth/sign-up/:path*"],
};
