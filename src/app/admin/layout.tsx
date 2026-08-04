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
 *
 * The chrome is an icon rail plus a thin top bar. Staff use this daily and know
 * where things are within a week; after that the horizontal space is worth more
 * than the labels, and the tables are what the job actually is. The rail can be
 * pinned open for anyone who disagrees.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import "@/styles/admin.css";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminRail } from "./AdminRail";
import { CommandPalette } from "./CommandPalette";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) redirect("/login");
  if (role !== "admin") {
    // Not a 403 page: a signed-in parent poking at /admin should see the same
    // thing they would see if the route did not exist.
    redirect("/portal");
  }

  // An unanswered enquiry is the one thing here with a clock on it, so it gets
  // the only badge in the rail. Everything else can wait for someone to look.
  const unanswered = await prisma.contactMessage.count({ where: { status: "NEW" } });

  return (
    <div className="admin">
      <AdminRail email={session.user.email} unanswered={unanswered} />

      <div className="admin__main">
        <header className="admin__topbar">
          <CommandPalette />
        </header>
        <div className="admin__content">{children}</div>
      </div>
    </div>
  );
}
