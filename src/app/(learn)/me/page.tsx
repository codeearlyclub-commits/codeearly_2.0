/**
 * The child's own home — what they are learning and what to do next.
 *
 * Reads the restricted child session, never a parent one.
 *
 * THIS IS WHERE THE GAMIFICATION LIVES, AND ONLY HERE. XP, levels, streaks and
 * badges motivate a nine-year-old; the parent portal shows the same underlying
 * facts as plain figures, because "Level 4" tells a parent nothing about whether
 * the money is working. Every number is derived from something the child
 * actually finished — see server/lms/progression.ts.
 *
 * Ordering is deliberate: continue-what-you-started comes before everything,
 * because a child arriving here wants to get back into a lesson, not read a
 * dashboard. The rewards sit underneath it, not in front of it.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import "@/styles/learn.css";
import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";
import { listChildLearning } from "@/server/lms/learning";
import { learningSummary, recentActivity } from "@/server/lms/tracking";
import { getLearnerProfile } from "@/server/lms/progression";
import { XpRing } from "./XpRing";

export const dynamic = "force-dynamic";

const ACTIVITY_LABEL: Record<string, string> = {
  LESSON_STARTED: "Started",
  LESSON_COMPLETED: "Finished",
  COURSE_COMPLETED: "Completed the course",
  QUIZ_PLAYED: "Played a quiz",
  PROGRAM_ATTENDED: "Attended",
};

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });

export default async function StudentHomePage() {
  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);
  if (!child) redirect("/student");

  const [courses, summary, activity, profile] = await Promise.all([
    listChildLearning(child.childId),
    learningSummary(child.childId),
    recentActivity(child.childId, 8),
    getLearnerProfile(child.childId),
  ]);

  const inProgress = courses.filter((c) => c.percentComplete > 0 && c.percentComplete < 100);
  const notStarted = courses.filter((c) => c.percentComplete === 0);
  const done = courses.filter((c) => c.percentComplete === 100);
  const earned = profile.badges.filter((b) => b.earned);

  return (
    <main className="learn">
      <div className="me-hero">
        <div className="me-hero__blob me-hero__blob--1" />
        <div className="me-hero__blob me-hero__blob--2" />

        <div className="me-hero__inner">
          <div className="me-hero__left">
            <div className="me-hero__eyebrow">Member {child.membershipId}</div>
            <h1>
              Hi {child.displayName}! <span>👋</span>
            </h1>

            <div className="me-chips">
              <span className="me-chip me-chip--level">
                ⭐ Level {profile.level} · {profile.levelTitle}
              </span>

              {profile.streakDays > 0 && (
                <span
                  className={
                    profile.activeToday ? "me-chip me-chip--streak" : "me-chip me-chip--streak me-chip--cold"
                  }
                  title={
                    profile.activeToday
                      ? "You've already learned something today"
                      : "Do one lesson today to keep your streak"
                  }
                >
                  🔥 {profile.streakDays} day{profile.streakDays === 1 ? "" : "s"} in a row
                </span>
              )}

              {earned.length > 0 && (
                <span className="me-chip">
                  🏅 {earned.length} badge{earned.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <XpRing
            percent={profile.percentToNext}
            level={profile.level}
            xp={profile.xp}
            xpToNext={profile.xpToNext}
            levelTitle={profile.levelTitle}
          />
        </div>
      </div>

      <div className="learn-body">
        {/* ── Keep going — first, always ─────────────────────────────────── */}
        {inProgress.length > 0 && (
          <section className="learn-section">
            <div className="learn-section__head">
              <div>
                <h2>Keep going</h2>
              </div>
              <span className="learn-section__count">{inProgress.length}</span>
            </div>
            <ul className="learn-list">
              {inProgress.map((course) => (
                <li key={course.courseId}>
                  <Link className="learn-item" href={`/learn/${course.slug}`}>
                    <span className="learn-tick" aria-hidden>
                      ▸
                    </span>
                    <span className="learn-item__main">
                      <span className="learn-item__title">{course.title}</span>
                      <span className="learn-item__sub">
                        {course.completedLessons} of {course.totalLessons} lessons ·{" "}
                        {course.percentComplete}%
                      </span>
                      <span
                        className="learn-progress__track"
                        style={{ marginTop: 8, height: 6, background: "var(--border)" }}
                      >
                        <span
                          className="learn-progress__fill"
                          style={{
                            width: `${course.percentComplete}%`,
                            display: "block",
                            height: "100%",
                          }}
                        />
                      </span>
                    </span>
                    {course.level && <span className="learn-item__kind">{course.level}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        {/* ── The numbers ────────────────────────────────────────────────── */}
        {profile.xp > 0 && (
          <section className="learn-section">
            <div className="learn-section__head">
              <div>
                <h2>Your progress</h2>
              </div>
            </div>
            <div className="me-stats">
              <div className="me-stat" style={{ "--tint": "var(--green)" } as React.CSSProperties}>
                <div className="me-stat__icon" aria-hidden>
                  📚
                </div>
                <div className="me-stat__value">{profile.counts.lessons}</div>
                <div className="me-stat__label">
                  lesson{profile.counts.lessons === 1 ? "" : "s"} finished
                </div>
              </div>
              <div className="me-stat" style={{ "--tint": "var(--purple)" } as React.CSSProperties}>
                <div className="me-stat__icon" aria-hidden>
                  🎓
                </div>
                <div className="me-stat__value">{profile.counts.courses}</div>
                <div className="me-stat__label">
                  course{profile.counts.courses === 1 ? "" : "s"} completed
                </div>
              </div>
              <div className="me-stat" style={{ "--tint": "var(--sky)" } as React.CSSProperties}>
                <div className="me-stat__icon" aria-hidden>
                  ⏱️
                </div>
                <div className="me-stat__value">{summary.totalMinutes}</div>
                <div className="me-stat__label">minutes learning</div>
              </div>
              <div className="me-stat" style={{ "--tint": "var(--orange)" } as React.CSSProperties}>
                <div className="me-stat__icon" aria-hidden>
                  🎯
                </div>
                <div className="me-stat__value">{profile.counts.quizzes}</div>
                <div className="me-stat__label">
                  quiz{profile.counts.quizzes === 1 ? "" : "zes"} played
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Start something new / finished ─────────────────────────────── */}
        {[
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
                            : `${course.completedLessons} of ${course.totalLessons} lessons`}
                        </span>
                      </span>
                      {course.level && <span className="learn-item__kind">{course.level}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {/* ── Badges ─────────────────────────────────────────────────────── */}
        <section className="learn-section">
          <div className="learn-section__head">
            <div>
              <h2>Badges</h2>
              <p>
                {earned.length} of {profile.badges.length} unlocked
              </p>
            </div>
          </div>
          <div className="me-badges">
            {profile.badges.map((badge) => (
              <div
                className={badge.earned ? "me-badge" : "me-badge me-badge--locked"}
                key={badge.id}
                title={badge.hint}
              >
                <div className="me-badge__icon" aria-hidden>
                  {badge.earned ? badge.icon : "🔒"}
                </div>
                <div className="me-badge__label">{badge.label}</div>
                {!badge.earned && <div className="me-badge__hint">{badge.hint}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Recent activity ────────────────────────────────────────────── */}
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
                      <span className="learn-item__sub">{dateFmt.format(entry.createdAt)}</span>
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
