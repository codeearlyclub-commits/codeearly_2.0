/**
 * Course builder — the curriculum for one course.
 *
 * Its own page rather than a modal: authoring a course is sustained work with a
 * lot on screen, and a modal that cannot be linked to or refreshed is the wrong
 * container for it.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { getCourseTree } from "@/server/lms/authoring";
import { isAppError } from "@/lib/errors";
import { CurriculumBuilder } from "./CurriculumBuilder";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CourseBuilderPage({ params }: Props) {
  const { id } = await params;

  let course;
  try {
    course = await getCourseTree(id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const published = [
    ...course.lessons,
    ...course.sections.flatMap((s) => s.lessons),
  ].filter((l) => l.published).length;
  const total = course.lessons.length + course.sections.reduce((n, s) => n + s.lessons.length, 0);

  return (
    <>
      <header className="admin__head">
        <p className="admin__crumbs">
          <Link href="/admin/courses">Courses</Link> <span aria-hidden>›</span>{" "}
          {course.title}
        </p>
        <h1>Curriculum</h1>
        <p className="muted">
          {total} lesson{total === 1 ? "" : "s"} · {published} published ·{" "}
          {total - published} draft. Drafts are invisible to children.
        </p>
      </header>

      <CurriculumBuilder
        courseId={course.id}
        courseSlug={course.slug}
        sections={course.sections.map((s) => ({
          id: s.id,
          title: s.title,
          summary: s.summary,
          lessons: s.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            kind: l.kind,
            summary: l.summary,
            published: l.published,
            estimatedMinutes: l.estimatedMinutes,
            videoUrl: l.videoUrl,
            blockCount: l._count.blocks,
            learners: l._count.progress,
          })),
        }))}
        looseLessons={course.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          kind: l.kind,
          summary: l.summary,
          published: l.published,
          estimatedMinutes: l.estimatedMinutes,
          videoUrl: l.videoUrl,
          blockCount: l._count.blocks,
          learners: l._count.progress,
        }))}
      />
    </>
  );
}
