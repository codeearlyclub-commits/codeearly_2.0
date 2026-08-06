/**
 * Two jobs, both about keeping the audiences apart.
 *
 * Next 16 renamed this file convention from `middleware` to `proxy`; same
 * function, same request/response shape.
 *
 * ── 1. ONE IDENTITY PER BROWSER ──────────────────────────────────────────────
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
 * pass through. This runs on the Edge and cannot reach Redis, so only the cookie
 * is dropped; the sign-in form additionally calls /api/student/logout, which
 * revokes the session row properly. This is the backstop.
 *
 * ── 2. THE ADMIN LIVES ON ITS OWN ORIGIN ─────────────────────────────────────
 *
 * When ADMIN_HOST is set, the staff tool moves to its own hostname and the two
 * surfaces stop sharing an origin:
 *
 *   www.codeearly.com/admin    → 404, as if it were never built
 *   admin.codeearly.com/       → the admin
 *   admin.codeearly.com/portal → 404; the admin host serves only the admin
 *
 * A separate origin means a separate cookie jar, so a session minted on the
 * marketing site is not sent to the admin at all. It also gives Caddy a whole
 * hostname to put an IP allowlist in front of, rather than a path prefix.
 *
 * Unset — the local default — everything stays on one host, because splitting
 * origins in development means editing hosts files to fix a problem nobody has
 * on their laptop.
 *
 * The RULE lives in lib/host-routing.ts as a pure function, so it can be tested
 * without standing up Next's request pipeline. This file only applies it.
 */
import { NextResponse, type NextRequest } from "next/server";

import { decideHostRouting } from "@/lib/host-routing";

const CHILD_COOKIE = "ce_child_session";

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const decision = decideHostRouting({
    host: req.headers.get("host"),
    path,
    adminHost: process.env.ADMIN_HOST?.trim() || null,
  });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.to, req.url));
  }

  if (decision.kind === "not-found") {
    // A rewrite to a path no route matches, so Next renders app/not-found.tsx
    // with a 404 — the same page a genuine typo produces. That sameness is the
    // point: a redirect, or a distinct error, would confirm to whoever is
    // probing that the path exists somewhere.
    return NextResponse.rewrite(new URL("/_wrong-host-404", req.url));
  }

  const res = NextResponse.next();

  // Only on sign-in/sign-up. Clearing on every /api/auth/* call would log a
  // child out whenever any page merely READ the parent session.
  const isSignIn =
    path.startsWith("/api/auth/sign-in") || path.startsWith("/api/auth/sign-up");

  if (isSignIn && req.cookies.has(CHILD_COOKIE)) {
    res.cookies.set({
      name: CHILD_COOKIE,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });
  }

  return res;
}

/**
 * Everything except static assets and image optimisation.
 *
 * Wider than the cookie work alone needs, because the host split has to see
 * every page request — a matcher that only covered /api/auth would let
 * `www.codeearly.com/admin` straight through.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|mp3|css|js)$).*)",
  ],
};
