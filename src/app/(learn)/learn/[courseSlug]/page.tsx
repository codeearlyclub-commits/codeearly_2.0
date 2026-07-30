/**
 * Course overview — the curriculum, and one clear next action.
 *
 * Modelled on Coursera/Udemy: a progress figure the child does not have to ask
 * for, sections that show what is left, and a single "continue" button that knows
 * where they got to. Without upsells, ratings or "students also bought" — a child
 * is not a funnel.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";

import "@/styles/learn.css";
import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";
import { getCourseForChild } from "@/server/lms/learning";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseSlug: string }> };

const KIND_LABEL: Record<string, string> = {
  LESSON: "Lesson",
  PAGE: "Reading",
  RESOURCE: "Resource",
  QUIZ: "Quiz",
};

export default async function CourseOverviewPage({ params }: Props) {
  const { courseSlug } = await params;

  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);
  // Learning is a child's activity, so this route needs a child session. A
  // parent viewing progress uses the portal, which is a different surface.
  if (!child) redirect("/student");

  let view;
  try {
    view = await getCourseForChild(child.childId, child.parentId, courseSlug);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    if (isAppError(err) && err.code === "FORBIDDEN") {
      return (
        <main className="learn">
          <div className="learn-hero">
            <div className="learn-hero__inner">
              <h1>Not unlocked yet</h1>
              <p>{err.publicMessage}</p>
            </div>
          </div>
          <div className="learn-body">
            <Link className="btn-primary" href="/me">
              Back to my learning
            </Link>
          </div>
        </main>
      );
    }
    throw err;
  }

  const groups = [
    ...(view.looseLessons.length > 0
      ? [{ id: "root", title: "Lessons", summary: null, lessons: view.looseLessons }]
      : []),
    ...view.sections.filter((s) => s.lessons.length > 0),
  ];

  const finished = view.percentComplete === 100 && view.totalLessons > 0;

  return (
    <main className="learn">
      <div className="learn-hero">
        <div className="learn-hero__inner">
          <span className="learn-hero__eyebrow">{view.course.level ?? "Course"}</span>
          <h1>{view.course.title}</h1>
          {view.course.description && <p>{view.course.description}</p>}

          <div className="learn-hero__meta">
            <span>
              <b>{view.totalLessons}</b> lesson{view.totalLessons === 1 ? "" : "s"}
            </span>
            {view.course.ageRange && (
              <span>
                Ages <b>{view.course.ageRange}</b>
              </span>
            )}
            <span>
              <b>{view.completedLessons}</b> finished
            </span>
          </div>

          <div className="learn-progress">
            <div className="learn-progress__top">
              <span>Your progress</span>
              <span className="learn-progress__pct">{view.percentComplete}%</span>
            </div>
            <div
              className="learn-progress__track"
              role="progressbar"
              aria-valuenow={view.percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Course progress"
            >
              <div className="learn-progress__fill" style={{ width: `${view.percentComplete}%` }} />
            </div>
          </div>

          <div className="learn-cta">
            {finished ? (
              <Link className="btn-primary" href="/me">
                🎉 Course complete — back to my learning
              </Link>
            ) : view.continueFrom ? (
              <Link
                className="btn-primary"
                href={`/learn/${view.course.slug}/${view.continueFrom.slug}`}
              >
                {view.completedLessons === 0 ? "Start learning →" : "Continue →"}
              </Link>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.7)" }}>
                Lessons are being added — check back soon.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="learn-body">
        {groups.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            This course does not have any lessons yet.
          </p>
        )}

        {groups.map((group) => {
          const done = group.lessons.filter((l) => l.status === "COMPLETED").length;
          return (
            <section className="learn-section" key={group.id}>
              <div className="learn-section__head">
                <div>
                  <h2>{group.title}</h2>
                  {group.summary && <p>{group.summary}</p>}
                </div>
                <span className="learn-section__count">
                  {done} / {group.lessons.length} done
                </span>
              </div>

              <ul className="learn-list">
                {group.lessons.map((lesson) => {
                  const isDone = lesson.status === "COMPLETED";
                  const isCurrent = view.continueFrom?.id === lesson.id;
                  return (
                    <li key={lesson.id}>
                      <Link
                        className="learn-item"
                        href={`/learn/${view.course.slug}/${lesson.slug}`}
                      >
                        <span
                          className={`learn-tick ${
                            isDone ? "learn-tick--done" : isCurrent ? "learn-tick--current" : ""
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span className="learn-item__main">
                          <span className="learn-item__title">{lesson.title}</span>
                          <span className="learn-item__sub">
                            {isDone
                              ? "Completed"
                              : isCurrent
                                ? "Up next"
                                : lesson.estimatedMinutes
                                  ? `About ${lesson.estimatedMinutes} min`
                                  : "Not started"}
                          </span>
                        </span>
                        <span className="learn-item__kind">
                          {KIND_LABEL[lesson.kind] ?? lesson.kind}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
