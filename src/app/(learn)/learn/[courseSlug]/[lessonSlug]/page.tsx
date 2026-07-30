/**
 * Lesson player.
 *
 * The Coursera/Udemy shape: a persistent curriculum rail so "where am I and how
 * much is left" never needs asking, content in a capped measure in the middle, and
 * prev/next plus complete at the foot.
 *
 * The rail is rendered on the SERVER with the child's real progress, so the ticks
 * are correct on first paint rather than appearing a moment later.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";

import "@/styles/learn.css";
import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";
import { getCourseForChild, getLessonForChild } from "@/server/lms/learning";
import { isAppError } from "@/lib/errors";
import { LessonBlocks } from "@/components/portal/LessonBlocks";
import { LessonFooter } from "./LessonFooter";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ courseSlug: string; lessonSlug: string }> };

export default async function LessonPage({ params }: Props) {
  const { courseSlug, lessonSlug } = await params;

  const token = (await cookies()).get(CHILD_SESSION_COOKIE)?.value;
  const child = await getChildSession(token);
  if (!child) redirect("/student");

  let data;
  let course;
  try {
    // Both are needed: the lesson for its content, the course view for the rail
    // and the progress figure. Opening the lesson also records that it started.
    [data, course] = await Promise.all([
      getLessonForChild(child.childId, child.parentId, courseSlug, lessonSlug),
      getCourseForChild(child.childId, child.parentId, courseSlug),
    ]);
  } catch (err) {
    if (isAppError(err) && (err.code === "NOT_FOUND" || err.code === "FORBIDDEN")) notFound();
    throw err;
  }

  const groups = [
    ...(course.looseLessons.length > 0
      ? [{ id: "root", title: "Lessons", lessons: course.looseLessons }]
      : []),
    ...course.sections.filter((s) => s.lessons.length > 0),
  ];

  const alreadyDone = data.progress.status === "COMPLETED";

  return (
    <div className="player">
      {/* ── Curriculum rail ────────────────────────────────────────────────── */}
      <nav className="player__rail" aria-label="Course contents">
        <Link className="player__back" href={`/learn/${courseSlug}`}>
          ← {course.course.title}
        </Link>

        <div className="player__progress">
          {course.completedLessons} of {course.totalLessons} lessons ·{" "}
          {course.percentComplete}%
        </div>
        <div
          className="player__track"
          role="progressbar"
          aria-valuenow={course.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="player__fill" style={{ width: `${course.percentComplete}%` }} />
        </div>

        {groups.map((group) => (
          <div className="player__group" key={group.id}>
            <h3>{group.title}</h3>
            {group.lessons.map((lesson) => {
              const isCurrent = lesson.slug === lessonSlug;
              const isDone = lesson.status === "COMPLETED";
              return (
                <Link
                  key={lesson.id}
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  className={`player__link${isCurrent ? " is-current" : ""}`}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <span
                    className={`player__dot${isDone ? " player__dot--done" : ""}`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{lesson.title}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="player__main">
        <div className="player__inner">
          <p className="player__pos">
            Lesson {data.position} of {data.total}
          </p>
          <h1 className="player__title">{data.lesson.title}</h1>
          {data.lesson.summary && <p className="player__summary">{data.lesson.summary}</p>}

          {data.lesson.videoUrl && (
            <p className="block block-text">
              <a href={data.lesson.videoUrl} target="_blank" rel="noopener noreferrer">
                Watch the lesson video ↗
              </a>
            </p>
          )}

          <LessonBlocks blocks={data.lesson.blocks} />

          <LessonFooter
            lessonId={data.lesson.id}
            courseSlug={courseSlug}
            alreadyCompleted={alreadyDone}
            nextSlug={data.next?.slug ?? null}
            nextTitle={data.next?.title ?? null}
            previousSlug={data.previous?.slug ?? null}
            blockCount={data.lesson.blocks.length}
          />
        </div>
      </main>
    </div>
  );
}
