/**
 * The child's own home — what they are learning and what to do next.
 *
 * Reads the restricted child session, never a parent one. Deliberately short:
 * a child arriving here wants to get back into a lesson, not read a dashboard.
 * Progress is shown because it motivates; nothing else competes with the
 * continue button.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/learn.css";
import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";
import { listChildLearning } from "@/server/lms/learning";
import { learningSummary, recentActivity } from "@/server/lms/tracking";

export const dynamic = "force-dynamic";

const ACTIVITY_LABEL: Record<string, string> = {
  LESSON_STARTED: "Started",
  LESSON_COMPLETED: "Finished",
  COURSE_COMPLETED: "Completed the course",
  QUIZ_PLAYED: "Played a quiz",
  PROGRAM_ATTENDED: "Attended",
};

export default async function StudentHomePage() {
  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);
  if (!child) redirect("/student");

  const [courses, summary, activity] = await Promise.all([
    listChildLearning(child.childId),
    learningSummary(child.childId),
    recentActivity(child.childId, 8),
  ]);

  const inProgress = courses.filter((c) => c.percentComplete > 0 && c.percentComplete < 100);
  const notStarted = courses.filter((c) => c.percentComplete === 0);
  const done = courses.filter((c) => c.percentComplete === 100);

  return (
    <main className="learn">
      <div className="learn-hero">
        <div className="learn-hero__inner">
          <span className="learn-hero__eyebrow">Member {child.membershipId}</span>
          <h1>Hi {child.displayName}! 👋</h1>
          <p>
            {inProgress.length > 0
              ? "Pick up where you left off."
              : courses.length > 0
                ? "Ready to start something new?"
                : "Your courses will appear here once you're enrolled."}
          </p>

          <div className="learn-hero__meta">
            <span>
              <b>{summary.lessonsCompleted}</b> lesson{summary.lessonsCompleted === 1 ? "" : "s"} finished
            </span>
            <span>
              <b>{summary.coursesCompleted}</b> course{summary.coursesCompleted === 1 ? "" : "s"} completed
            </span>
            <span>
              <b>{summary.totalMinutes}</b> minutes learning
            </span>
          </div>
        </div>
      </div>

      <div className="learn-body">
        {courses.length === 0 && (
          <section className="learn-section">
            <div className="learn-section__head">
              <div>
                <h2>No courses yet</h2>
                <p>Ask your parent to enrol you and they will show up right here.</p>
              </div>
            </div>
          </section>
        )}

        {[
          { title: "Keep going", items: inProgress },
          { title: "Start something new", items: notStarted },
          { title: "Finished 🎉", items: done },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section className="learn-section" key={group.title}>
              <div className="learn-section__head">
                <div>
                  <h2>{group.title}</h2>
                </div>
                <span className="learn-section__count">{group.items.length}</span>
              </div>
              <ul className="learn-list">
                {group.items.map((course) => (
                  <li key={course.courseId}>
                    <Link className="learn-item" href={`/learn/${course.slug}`}>
                      <span
                        className={`learn-tick ${
                          course.percentComplete === 100 ? "learn-tick--done" : ""
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="learn-item__main">
                        <span className="learn-item__title">{course.title}</span>
                        <span className="learn-item__sub">
                          {course.totalLessons === 0
                            ? "Lessons coming soon"
                            : `${course.completedLessons} of ${course.totalLessons} lessons · ${course.percentComplete}%`}
                        </span>
                        {course.totalLessons > 0 && (
                          <span
                            className="learn-progress__track"
                            style={{ marginTop: 8, height: 6, background: "var(--border)" }}
                          >
                            <span
                              className="learn-progress__fill"
                              style={{ width: `${course.percentComplete}%`, display: "block", height: "100%" }}
                            />
                          </span>
                        )}
                      </span>
                      {course.level && <span className="learn-item__kind">{course.level}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {activity.length > 0 && (
          <section className="learn-section">
            <div className="learn-section__head">
              <div>
                <h2>Recently</h2>
              </div>
            </div>
            <ul className="learn-list">
              {activity.map((entry) => (
                <li key={entry.id}>
                  <div className="learn-item">
                    <span className="learn-tick learn-tick--done" aria-hidden>
                      ✓
                    </span>
                    <span className="learn-item__main">
                      <span className="learn-item__title">
                        {ACTIVITY_LABEL[entry.kind] ?? entry.kind}: {entry.label}
                      </span>
                      <span className="learn-item__sub">
                        {entry.createdAt.toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A form cannot live inside a <p> — invalid HTML, and browsers close
            the paragraph early, which breaks the layout in ways that only show
            up in some engines. */}
        <div style={{ marginTop: 24 }}>
          <form action="/api/student/logout" method="post">
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
