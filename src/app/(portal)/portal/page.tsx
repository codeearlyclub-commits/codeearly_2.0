/**
 * Parent portal — the child list.
 *
 * A server component: it calls the domain service directly rather than fetching
 * its own API over HTTP. Same rules either way, because the rules live in
 * `src/server/*` and both entry points call into them.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { listChildren } from "@/server/members/children";
import { ChildrenPanel } from "./ChildrenPanel";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const verified = Boolean(session.user.emailVerified);
  const children = verified ? await listChildren(session.user.id) : [];

  return (
    <main className="portal">
      <header className="portal-header">
        <div>
          <h1>Hi {session.user.name || "there"}</h1>
          <p className="muted">{session.user.email}</p>
        </div>
        <Link href="/portal/account" className="muted">
          Account
        </Link>
      </header>

      {!verified ? (
        <section className="notice">
          <h2>Confirm your email first</h2>
          <p>
            We sent a link to <b>{session.user.email}</b>. Click it to unlock
            adding children, enrolling and payments.
          </p>
        </section>
      ) : (
        <ChildrenPanel
          initialChildren={children.map((c) => ({
            id: c.id,
            name: c.childName,
            membershipId: c.membershipId,
            studentLoginEnabled: c.loginEnabled,
          }))}
        />
      )}
    </main>
  );
}
