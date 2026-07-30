"use client";

/**
 * Lesson footer: mark complete, move on — and the engagement heartbeat.
 *
 * The heartbeat only counts time the tab is VISIBLE. A lesson left open in a
 * background tab while a child plays something else is not study, and reporting
 * it as such would put a number on a report card that a parent would be right to
 * question.
 *
 * It also stops entirely once the lesson is complete: there is nothing left to
 * measure, and continuing would inflate the figure for re-reading.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HEARTBEAT_SECONDS = 30;

export function LessonFooter({
  lessonId,
  courseSlug,
  alreadyCompleted,
  nextSlug,
  nextTitle,
  previousSlug,
  blockCount,
}: {
  lessonId: string;
  courseSlug: string;
  alreadyCompleted: boolean;
  nextSlug: string | null;
  nextTitle: string | null;
  previousSlug: string | null;
  blockCount: number;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(alreadyCompleted);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const report = useCallback(
    async (payload: Record<string, unknown>) => {
      // keepalive so a report still lands when the child navigates away
      // mid-flight — otherwise the last chunk of every lesson is lost.
      await fetch(`/api/portal/lessons/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    },
    [lessonId]
  );

  useEffect(() => {
    // Nothing left to measure once the lesson is done, and continuing would
    // inflate the figure for re-reading. Gating the effect on `completed` also
    // avoids writing to a ref during render.
    if (completed) return;

    const id = setInterval(() => {
      // Only count time the lesson is actually on screen. A lesson left open in
      // a background tab while a child plays something else is not study, and
      // reporting it as such would put a number on a report card that a parent
      // would be right to question.
      if (document.visibilityState !== "visible") return;
      void report({ seconds: HEARTBEAT_SECONDS });
    }, HEARTBEAT_SECONDS * 1000);

    return () => clearInterval(id);
  }, [completed, report]);

  // Remember roughly how far they read, so "continue" lands in the right place.
  useEffect(() => {
    if (blockCount === 0) return;
    const onScroll = () => {
      const progressed = window.scrollY + window.innerHeight;
      const total = document.body.scrollHeight || 1;
      const fraction = Math.min(1, progressed / total);
      const block = Math.floor(fraction * blockCount);
      // Fire-and-forget; the server only ever moves the marker forward.
      void report({ blockOrder: block });
    };
    // Reported on leaving rather than on every scroll event, to keep this to one
    // request per lesson instead of hundreds on a metered connection.
    window.addEventListener("pagehide", onScroll);
    return () => window.removeEventListener("pagehide", onScroll);
  }, [blockCount, report]);

  async function markComplete() {
    setBusy(true);
    const res = await fetch(`/api/portal/lessons/${lessonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) return;

    setCompleted(true);
    if (body?.courseCompleted) setCelebrate(true);
    router.refresh();
  }

  return (
    <>
      {celebrate && (
        <div className="course-done" role="status">
          <h2>🎉 You finished the whole course!</h2>
          <p>Every lesson done. That is a real achievement — well played.</p>
        </div>
      )}

      <div className="player__foot">
        {previousSlug ? (
          <Link className="btn-secondary" href={`/learn/${courseSlug}/${previousSlug}`}>
            ← Previous
          </Link>
        ) : (
          <Link className="btn-secondary" href={`/learn/${courseSlug}`}>
            ← Contents
          </Link>
        )}

        <span className="spacer" />

        {completed ? (
          <span className="done-pill">✓ Completed</span>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={markComplete}
            disabled={busy}
          >
            {busy ? "Saving…" : "Mark as done"}
          </button>
        )}

        {nextSlug && (
          <Link className="btn-primary" href={`/learn/${courseSlug}/${nextSlug}`}>
            {nextTitle ? "Next lesson →" : "Next →"}
          </Link>
        )}
      </div>
    </>
  );
}
