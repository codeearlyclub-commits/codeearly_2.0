"use client";

/**
 * Writing a report and issuing certificates for one child.
 *
 * The figures are NOT typed. Choosing a period fetches what the child actually
 * did, and staff write the comment around real numbers — which is the whole point
 * of having tracked them. A report card assembled from memory is worse than none,
 * because a parent will believe it.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Report = {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "PUBLISHED";
  comment: string | null;
  overallGrade: string | null;
  lessonsCompleted: number;
  coursesCompleted: number;
  minutesLearning: number;
  quizzesPlayed: number;
  publishedAt: string | null;
};

type Certificate = {
  id: string;
  serial: string;
  title: string;
  issuedAt: string;
  revoked: boolean;
  revokedReason: string | null;
};

type Figures = {
  lessonsCompleted: number;
  coursesCompleted: number;
  minutesLearning: number;
  quizzesPlayed: number;
};

/** Sensible default: the current calendar year, which most terms sit inside. */
function defaultPeriod() {
  const year = new Date().getFullYear();
  return {
    period: `Term ${Math.ceil((new Date().getMonth() + 1) / 4)}, ${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

export function RecordsAdmin({
  child,
  reports,
  certificates,
  awaiting,
}: {
  child: { id: string; name: string; membershipId: string; parentName: string; parentEmail: string };
  reports: Report[];
  certificates: Certificate[];
  awaiting: Array<{ courseId: string; title: string }>;
}) {
  const router = useRouter();
  const initial = defaultPeriod();

  const [period, setPeriod] = useState(initial.period);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [comment, setComment] = useState("");
  const [grade, setGrade] = useState("");
  const [figures, setFigures] = useState<Figures | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "That didn't work.")
      );
    }
    return body;
  }

  async function preview() {
    setError(null);
    setBusy(true);
    try {
      const body = await call(
        `/api/admin/reports?childId=${child.id}&start=${start}&end=${end}`,
        { method: "GET" }
      );
      setFigures(body.figures);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveReport(publish: boolean) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      await call("/api/admin/reports", {
        method: "POST",
        body: JSON.stringify({
          childId: child.id,
          period,
          periodStart: start,
          periodEnd: end,
          comment: comment || null,
          overallGrade: grade || null,
          publish,
        }),
      });
      setNote(publish ? `Published — ${child.parentName} can see it now.` : "Saved as a draft.");
      setComment("");
      setGrade("");
      setFigures(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unpublish(id: string) {
    if (!confirm("Unpublish this report? The parent will no longer see it until it is published again.")) return;
    setBusy(true);
    try {
      await call("/api/admin/reports", { method: "PATCH", body: JSON.stringify({ id }) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function issueAll() {
    setError(null);
    setBusy(true);
    try {
      const body = await call("/api/admin/certificates", {
        method: "POST",
        body: JSON.stringify({ childId: child.id }),
      });
      setNote(
        body.created === 0
          ? "Nothing outstanding — every completed course already has a certificate."
          : `Issued ${body.created} new certificate${body.created === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(cert: Certificate) {
    const reason = prompt(
      `Withdraw the certificate for "${cert.title}"?\n\nThe serial will still verify, and will say it was withdrawn along with this reason:`
    );
    if (!reason?.trim()) return;

    setBusy(true);
    try {
      await call("/api/admin/certificates", {
        method: "PATCH",
        body: JSON.stringify({ id: cert.id, reason }),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>{child.name}</h2>
        <p className="muted">
          {child.membershipId} · parent {child.parentName} ({child.parentEmail})
        </p>
      </div>

      {error && <p role="alert" className="error">{error}</p>}
      {note && <p className="checkout__ok">{note}</p>}

      {/* ── Write a report ─────────────────────────────────────────────────── */}
      <div className="panel">
        <h2>Write a report card</h2>

        <div className="row">
          <label>
            Period name
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Term 2, 2026" />
          </label>
          <label>
            From
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <div className="admin__actions">
          <button type="button" className="btn-secondary" onClick={preview} disabled={busy}>
            {busy ? "Working…" : "Load this child's figures"}
          </button>
        </div>

        {figures && (
          <>
            {/* Shown before the comment box on purpose: staff should write about
                what the numbers say, not decide the verdict first. */}
            <div className="report__figures">
              <div className="report__figure">
                <b>{figures.lessonsCompleted}</b>
                <span>Lessons completed</span>
              </div>
              <div className="report__figure">
                <b>{figures.coursesCompleted}</b>
                <span>Courses finished</span>
              </div>
              <div className="report__figure">
                <b>{figures.minutesLearning}</b>
                <span>Minutes learning</span>
              </div>
              <div className="report__figure">
                <b>{figures.quizzesPlayed}</b>
                <span>Quizzes played</span>
              </div>
            </div>

            <label>
              Overall
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Excellent · Working hard · Needs encouragement"
              />
            </label>

            <label>
              Comment for the parent
              <textarea
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What went well, what to work on next term."
                maxLength={3000}
              />
            </label>

            <div className="modal__actions">
              <button type="button" onClick={() => saveReport(false)} disabled={busy}>
                Save draft
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => saveReport(true)}
                disabled={busy}
              >
                Publish to parent
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Existing reports ───────────────────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="panel">
          <h2>Reports</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Figures</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <b>{report.period}</b>
                    <br />
                    <span className="muted">
                      {report.periodStart} → {report.periodEnd}
                    </span>
                  </td>
                  <td className="muted">
                    {report.lessonsCompleted} lessons · {report.coursesCompleted} courses ·{" "}
                    {report.minutesLearning} min
                  </td>
                  <td>
                    <span className={`pill pill--${report.status.toLowerCase()}`}>
                      {report.status}
                    </span>
                    {report.publishedAt && (
                      <>
                        <br />
                        <span className="muted">{report.publishedAt}</span>
                      </>
                    )}
                  </td>
                  <td className="table__actions">
                    {report.status === "PUBLISHED" && (
                      <button type="button" onClick={() => unpublish(report.id)} disabled={busy}>
                        Unpublish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Certificates ───────────────────────────────────────────────────── */}
      <div className="panel">
        <h2>Certificates</h2>

        {awaiting.length > 0 ? (
          <>
            {/* The screen states who is owed a certificate, rather than leaving
                it as something someone must remember to check. */}
            <p className="muted">
              {awaiting.length} completed course
              {awaiting.length === 1 ? "" : "s"} without a certificate:{" "}
              {awaiting.map((a) => a.title).join(", ")}
            </p>
            <div className="admin__actions">
              <button type="button" className="btn-primary" onClick={issueAll} disabled={busy}>
                Issue {awaiting.length} certificate{awaiting.length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Every completed course has a certificate.</p>
        )}

        {certificates.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Award</th>
                <th>Serial</th>
                <th>Issued</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id}>
                  <td>
                    <b>{cert.title}</b>
                    {cert.revoked && (
                      <>
                        <br />
                        <span className="muted">Withdrawn — {cert.revokedReason}</span>
                      </>
                    )}
                  </td>
                  <td><code>{cert.serial}</code></td>
                  <td>{cert.issuedAt}</td>
                  <td className="table__actions">
                    <Link className="table__link" href={`/certificates/${cert.serial}`} target="_blank">
                      View
                    </Link>
                    {!cert.revoked && (
                      <button type="button" onClick={() => revoke(cert)} disabled={busy}>
                        Withdraw
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
