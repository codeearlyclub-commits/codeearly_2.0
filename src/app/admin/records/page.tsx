/**
 * Reports & certificates — staff view.
 *
 * Child-first: everything here is about one child, so the child is chosen before
 * anything else appears. A combined list of every report in the system would look
 * busier and answer no question anyone actually asks.
 *
 * Selection is a URL parameter rather than component state, so a link to a
 * particular child's records can be pasted into a support conversation.
 */
import Link from "next/link";

import "@/styles/certificate.css";
import { listFamilies } from "@/server/members/admin";
import { getChildRecords } from "@/server/records/reports";
import { RecordsAdmin } from "./RecordsAdmin";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ childId?: string; q?: string }> };

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminRecordsPage({ searchParams }: Props) {
  const { childId, q } = await searchParams;

  const families = await listFamilies({ q, take: 25 });
  const records = childId ? await getChildRecords(childId) : null;

  return (
    <>
      <header className="admin__head">
        <h1>Reports &amp; certificates</h1>
        <p className="muted">
          Figures are computed from what the child actually did. Published reports
          freeze — correcting one means unpublishing it first.
        </p>
      </header>

      <form className="admin__search" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Find a family — email, parent name, child name, or CE-2026-XXXX"
          aria-label="Search families"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="records-layout">
        <aside className="panel">
          <h2>Children</h2>
          {families.length === 0 ? (
            <p className="muted">{q ? `Nothing matches "${q}".` : "No families yet."}</p>
          ) : (
            <ul className="records-children">
              {families.flatMap((family) =>
                family.children.map((kid) => (
                  <li key={kid.id}>
                    <Link
                      href={`/admin/records?childId=${kid.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      className={kid.id === childId ? "is-current" : ""}
                    >
                      <b>{kid.name}</b>
                      <span className="muted">
                        {kid.membershipId} · {family.name}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
          {families.every((f) => f.children.length === 0) && families.length > 0 && (
            <p className="muted">These families have not added children yet.</p>
          )}
        </aside>

        <div>
          {!records ? (
            <div className="panel">
              <p className="muted">
                Choose a child to see their reports and certificates.
              </p>
            </div>
          ) : (
            <RecordsAdmin
              child={{
                id: records.child.id,
                name: records.child.childName,
                membershipId: records.child.membershipId,
                parentName: records.child.parent.name,
                parentEmail: records.child.parent.email,
              }}
              reports={records.reports.map((r) => ({
                id: r.id,
                period: r.period,
                periodStart: r.periodStart.toISOString().slice(0, 10),
                periodEnd: r.periodEnd.toISOString().slice(0, 10),
                status: r.status,
                comment: r.comment,
                overallGrade: r.overallGrade,
                lessonsCompleted: r.lessonsCompleted,
                coursesCompleted: r.coursesCompleted,
                minutesLearning: r.minutesLearning,
                quizzesPlayed: r.quizzesPlayed,
                publishedAt: r.publishedAt ? dateFmt.format(r.publishedAt) : null,
              }))}
              certificates={records.certificates.map((c) => ({
                id: c.id,
                serial: c.serial,
                title: c.title,
                issuedAt: dateFmt.format(c.issuedAt),
                revoked: c.revokedAt !== null,
                revokedReason: c.revokedReason,
              }))}
              awaiting={records.awaitingCertificate.map((c) => ({
                courseId: c.courseId,
                title: c.course.title,
              }))}
            />
          )}
        </div>
      </div>
    </>
  );
}
