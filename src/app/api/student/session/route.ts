/**
 * Who is signed in as a student: GET /api/student/session
 *
 * Exists so the public navbar can tell a signed-in child apart from a stranger.
 * The public layout deliberately reads no cookies — doing so forces every
 * marketing page to render per-request and defeats caching, which is what made
 * V4's cold loads ~10s — so the navbar asks over the wire instead, exactly as it
 * already does for the parent session.
 *
 * Returns the display name and membership ID only. Never the token, never the
 * parent's details.
 */
import { apiHandler } from "@/lib/api";
import { getChild } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const child = await getChild(req);
  if (!child) return { child: null };

  return {
    child: {
      displayName: child.displayName,
      membershipId: child.membershipId,
    },
  };
});
