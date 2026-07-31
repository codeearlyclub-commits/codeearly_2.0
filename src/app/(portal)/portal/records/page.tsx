/**
 * Parent view of report cards and certificates.
 *
 * Only PUBLISHED reports appear — a draft is staff working, not a document for a
 * family. Certificates link to the public verification page, so a parent can send
 * that link to a school rather than a photograph of a piece of paper.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/certificate.css";
import { auth } from "@/lib/auth";
import { listReportsForParent, listCertificatesForParent } from "@/server/records/reports";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function RecordsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [reports, certificates] = await Promise.all([
    listReportsForParent(session.user.id),
    listCertificatesForParent(session.user.id),
  ]);

  return (
    <main className="portal-page">
      <h1>Reports &amp; certificates</h1>

      {reports.length === 0 && certificates.length === 0 && (
        <p className="muted">
          Nothing here yet. Report cards appear at the end of each term, and
          certificates when your child completes a course.
        </p>
      )}

      {certificates.length > 0 && (
        <section className="panel">
          <h2>Certificates</h2>
          <ul className="invoice-list">
            {certificates.map((cert) => (
              <li key={cert.serial}>
                <div>
                  <b>{cert.title}</b>
                  <br />
                  <span className="muted">
                    {cert.child.childName} · {dateFmt.format(cert.issuedAt)}
                    {cert.revokedAt && " · withdrawn"}
                  </span>
                </div>
                <div className="invoice-list__pay">
                  <code className="muted">{cert.serial}</code>
                  {/* Opens the public page — the same one a school would see,
                      which is also the printable version. */}
                  <Link className="btn-primary" href={`/certificates/${cert.serial}`}>
                    View &amp; print
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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

          {report.overallGrade && <span className="report__grade">{report.overallGrade}</span>}

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
    </main>
  );
}
