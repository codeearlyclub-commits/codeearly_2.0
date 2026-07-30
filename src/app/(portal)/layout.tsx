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

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/portal", label: "Home" },
  { href: "/portal/courses", label: "Courses" },
  { href: "/portal/programs", label: "Programs" },
  { href: "/portal/invoices", label: "Payments" },
  { href: "/portal/account", label: "Account" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const role = (session.user as { role?: string }).role;

  return (
    <div className="portal-shell">
      <header className="portal-bar">
        <div className="portal-bar__inner">
          <Link href="/portal" className="portal-bar__brand">
            Code<span>Early</span>
          </Link>

          <nav className="portal-bar__nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            {role === "admin" && (
              <Link href="/admin" className="portal-bar__admin">
                Admin
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="portal-body">{children}</div>
    </div>
  );
}
