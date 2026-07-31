/**
 * Admin shell.
 *
 * The guard is here, in the layout, rather than repeated in every page. A page
 * added later inherits protection by existing in this folder, which is the
 * opposite of V4 — where each admin route checked for itself and one that
 * forgot was simply open.
 *
 * Note this protects the *pages*. Every admin API route calls requireAdmin
 * independently, because a layout cannot protect a fetch.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/admin.css";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  {
    group: "Overview",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    group: "Learning",
    items: [
      { href: "/admin/courses", label: "Courses" },
      { href: "/admin/programs", label: "Programs" },
      { href: "/admin/records", label: "Reports & certificates" },
    ],
  },
  {
    group: "Live",
    items: [{ href: "/admin/competitions", label: "Quizzes" }],
  },
  {
    group: "People",
    items: [{ href: "/admin/members", label: "Members" }],
  },
  {
    group: "Money",
    items: [{ href: "/admin/invoices", label: "Invoices" }],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) redirect("/login");
  if (role !== "admin") {
    // Not a 403 page: a signed-in parent poking at /admin should see the same
    // thing they would see if the route did not exist.
    redirect("/portal");
  }

  return (
    <div className="admin">
      <aside className="admin__side">
        <Link href="/admin" className="admin__brand">
          Code<span>Early</span> <small>admin</small>
        </Link>

        <nav>
          {NAV.map((section) => (
            <div key={section.group} className="admin__group">
              <h2>{section.group}</h2>
              {section.items.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin__foot">
          <p className="muted">{session.user.email}</p>
          <Link href="/portal" className="muted">
            ← Back to portal
          </Link>
        </div>
      </aside>

      <div className="admin__main">{children}</div>
    </div>
  );
}
