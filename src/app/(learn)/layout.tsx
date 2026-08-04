/**
 * Learner shell — the surfaces a CHILD uses.
 *
 * A separate route group from `(portal)` on purpose, and the reason is a bug this
 * layout exists to prevent: `(portal)`'s layout requires a PARENT session, so
 * while `/learn` and `/me` lived under it a signed-in child was redirected away
 * from their own lessons. Every route was a 307.
 *
 * The two audiences need different guards, so they get different groups. A child
 * page placed here is protected by the child guard automatically; there is no
 * shared layout that could quietly apply the wrong one.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";

export const dynamic = "force-dynamic";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);

  // A CHILD session is required — a parent session does not substitute for one,
  // and deliberately never will. Everything below reads and writes progress
  // against `child.childId`; letting a parent in would mean writing a parent's
  // activity onto a child's record, and there is no correct childId to use.
  //
  // Sent to the student sign-in, not the parent one. A child bounced to a page
  // asking for an email address has no way forward.
  if (!child) redirect("/student");

  return <>{children}</>;
}
