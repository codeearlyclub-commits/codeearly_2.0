/**
 * Portal shell.
 *
 * Guards every portal page in one place, the same way the admin layout does —
 * a page added to this folder later is protected by existing here.
 *
 * Note it allows an UNVERIFIED parent through. They need to reach the portal to
 * be told to check their email; bouncing them to /login would look like their
 * password was wrong. Individual actions that spend money require verification
 * separately, in the API.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/portal.css";
import { auth } from "@/lib/auth";
import { PortalNavBar, PortalTabs } from "./portal/PortalNav";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role;
  const name = session.user.name || session.user.email;

  return (
    <div className="portal-shell">
      <header className="portal-bar">
        <div className="portal-bar__inner">
          <Link href="/portal" className="portal-bar__brand">
            Code<span>Early</span>
          </Link>

          <PortalNavBar isAdmin={role === "admin"} />

          <div className="portal-bar__who">
            <Link
              href="/portal/account"
              className="portal-bar__avatar"
              aria-label={`Account — signed in as ${name}`}
              title={name}
            >
              {name.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </div>
      </header>

      <div className="portal-body">{children}</div>

      {/* Phones only. Hidden at 860px, where the top bar takes over. */}
      <PortalTabs />
    </div>
  );
}
