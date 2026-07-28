/**
 * Admin dashboard.
 *
 * Numbers that reflect what is actually in the database, counted at request
 * time. V4's dashboard cached some of these and drifted, which made it useless
 * for the one thing a dashboard is for: telling you whether something is wrong.
 */
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    parents,
    children,
    publishedCourses,
    draftCourses,
    publishedPrograms,
    activeSubs,
    paidTotal,
    pendingInvoices,
    recentChildren,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "user" } }),
    prisma.child.count(),
    prisma.course.count({ where: { status: "PUBLISHED" } }),
    prisma.course.count({ where: { status: "DRAFT" } }),
    prisma.program.count({ where: { status: "PUBLISHED" } }),
    prisma.subscription.count({ where: { status: "active", endDate: { gt: new Date() } } }),
    prisma.payment.aggregate({ _sum: { amountKobo: true }, where: { status: "success" } }),
    prisma.invoice.count({ where: { status: "PENDING" } }),
    prisma.child.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, childName: true, membershipId: true, createdAt: true },
    }),
  ]);

  const stats = [
    { label: "Parents", value: parents, href: "/admin/members" },
    { label: "Children", value: children, href: "/admin/members" },
    { label: "Active memberships", value: activeSubs, href: null },
    { label: "Pending invoices", value: pendingInvoices, href: "/admin/invoices" },
    { label: "Published courses", value: publishedCourses, href: "/admin/courses" },
    { label: "Published programs", value: publishedPrograms, href: "/admin/programs" },
  ];

  return (
    <>
      <header className="admin__head">
        <h1>Dashboard</h1>
        <p className="muted">Everything below is counted live from the database.</p>
      </header>

      <div className="stat-grid">
        {stats.map((stat) => {
          const body = (
            <>
              <span className="stat__value">{stat.value.toLocaleString("en-NG")}</span>
              <span className="stat__label">{stat.label}</span>
            </>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="stat">
              {body}
            </Link>
          ) : (
            <div key={stat.label} className="stat">
              {body}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h2>Money received</h2>
        <p className="stat__value stat__value--lg">
          {formatNaira(paidTotal._sum.amountKobo ?? 0)}
        </p>
        <p className="muted">
          Total of every confirmed payment. Counted from the payment ledger, not
          from invoices — an invoice marked paid by hand would not appear here.
        </p>
      </div>

      {draftCourses > 0 && (
        <div className="panel panel--warn">
          <h2>{draftCourses} unpublished course{draftCourses === 1 ? "" : "s"}</h2>
          <p>
            Drafts are invisible to parents. <Link href="/admin/courses">Review them</Link>.
          </p>
        </div>
      )}

      <div className="panel">
        <h2>Newest members</h2>
        {recentChildren.length === 0 ? (
          <p className="muted">No children registered yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Membership ID</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentChildren.map((child) => (
                <tr key={child.id}>
                  <td>{child.childName}</td>
                  <td><code>{child.membershipId}</code></td>
                  <td>{child.createdAt.toLocaleDateString("en-NG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
