/**
 * Parent view of report cards and certificates.
 *
 * Only PUBLISHED reports appear — a draft is staff working, not a document for a
 * family. Certificates link to the public verification page, so a parent can send
 * that link to a school rather than a photograph of a piece of paper.
 *
 * When a `childId` is in the URL the page narrows to that child. The dashboard
 * links here that way, and it means "Ada's reports" is a URL a parent can keep.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/certificate.css";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listReportsForParent, listCertificatesForParent } from "@/server/records/reports";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Props = { searchParams: Promise<{ childId?: string }> };

export default async function RecordsPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { childId } = await searchParams;

  const [allReports, allCertificates, children] = await Promise.all([
    listReportsForParent(session.user.id),
    listCertificatesForParent(session.user.id),
    prisma.child.findMany({
      where: { parentId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, childName: true },
    }),
  ]);

  // Filtering happens here rather than in the query because both services are
  // already parent-scoped; narrowing further is a view concern, and an unknown
  // childId simply shows nothing rather than someone else's child.
  const filtering = Boolean(childId && children.some((c) => c.id === childId));
  const reports = filtering ? allReports.filter((r) => r.childId === childId) : allReports;
  const certificates = filtering
    ? allCertificates.filter((c) => c.childId === childId)
    : allCertificates;

  return (
    <>
      <header className="portal-head">
        <h1>Reports &amp; certificates</h1>
        <p>Everything your child has been awarded, ready to print or share.</p>
      </header>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <Link href="/portal/records" className={filtering ? "pbtn" : "pbtn pbtn--primary"}>
            Everyone
          </Link>
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/portal/records?childId=${child.id}`}
              className={childId === child.id ? "pbtn pbtn--primary" : "pbtn"}
            >
              {child.childName}
            </Link>
          ))}
        </div>
      )}

      {reports.length === 0 && certificates.length === 0 && (
        <div className="pempty">
          <div className="pempty__icon">🏆</div>
          <h3>Nothing here yet</h3>
          <p>
            Report cards appear at the end of each term, and certificates the moment
            your child finishes a course. Both are printable and independently
            verifiable.
          </p>
        </div>
      )}

      {certificates.length > 0 && (
        <section className="portal-section">
          <div className="portal-section__head">
            <h2>Certificates</h2>
            <span className="ppill ppill--muted">{certificates.length}</span>
          </div>
          {certificates.map((cert) => (
            <div className="prow" key={cert.serial}>
              <div className="prow__main">
                <div className="prow__title">
                  {cert.title}
                  {cert.revokedAt && <span className="ppill ppill--failed"> withdrawn</span>}
                </div>
                <div className="prow__sub">
                  {cert.child.childName} · {dateFmt.format(cert.issuedAt)} ·{" "}
                  <code>{cert.serial}</code>
                </div>
              </div>
              <div className="prow__end">
                {/* Opens the public page — the same one a school would see, which
                    is also the printable version. */}
                <Link className="pbtn pbtn--primary" href={`/certificates/${cert.serial}`}>
                  View &amp; print
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}

      {reports.length > 0 && (
        <section className="portal-section">
          <div className="portal-section__head">
            <h2>Report cards</h2>
            <span className="ppill ppill--muted">{reports.length}</span>
          </div>

          {reports.map((report) => (
            <section className="report" key={report.id} style={{ marginBottom: 20 }}>
              <div className="report__head">
                <div>
                  <h1>{report.child.childName}</h1>
                  <p className="muted">
                    {report.period} · {report.child.membershipId}
                  </p>
                </div>
                <div className="report__meta">
                  {dateFmt.format(report.periodStart)} —<br />
                  {dateFmt.format(report.periodEnd)}
                </div>
              </div>

              {report.overallGrade && (
                <span className="report__grade">{report.overallGrade}</span>
              )}

              <div className="report__figures">
                <div className="report__figure">
                  <b>{report.lessonsCompleted}</b>
                  <span>Lessons completed</span>
                </div>
                <div className="report__figure">
                  <b>{report.coursesCompleted}</b>
                  <span>Courses finished</span>
                </div>
                <div className="report__figure">
                  <b>{report.minutesLearning}</b>
                  <span>Minutes learning</span>
                </div>
                <div className="report__figure">
                  <b>{report.quizzesPlayed}</b>
                  <span>Quizzes played</span>
                </div>
              </div>

              {report.comment && <div className="report__comment">{report.comment}</div>}
            </section>
          ))}
        </section>
      )}
    </>
  );
}
