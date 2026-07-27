/**
 * The child's own page — what a student sees after signing in with their code.
 *
 * Reads the restricted child session, never a parent one. If a parent opens
 * this URL they are sent to their own portal instead: this view is scoped to a
 * single child by design, and quietly showing a parent "a" child would be a
 * guess about which one they meant.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);
  if (!child) redirect("/student");

  return (
    <main className="portal">
      <h1>Hi {child.displayName}!</h1>
      <p className="muted">Member {child.membershipId}</p>

      <section className="notice">
        <h2>Your lessons are coming soon</h2>
        <p>
          This is where your courses, tasks and quizzes will appear. We&apos;re
          building them right now.
        </p>
      </section>

      <form action="/api/student/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
