import { listAllCourses } from "@/server/courses/admin";
import { CoursesAdmin } from "./CoursesAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const courses = await listAllCourses();

  return (
    <>
      <header className="admin__head">
        <h1>Courses</h1>
        <p className="muted">
          Drafts are invisible to parents. Program-only courses never appear in
          the public catalogue.
        </p>
      </header>

      <CoursesAdmin
        initial={courses.map((c) => ({
          id: c.id,
          title: c.title,
          slug: c.slug,
          description: c.description,
          level: c.level,
          ageRange: c.ageRange,
          status: c.status,
          priceKobo: c.priceKobo,
          requiresSubscription: c.requiresSubscription,
          programOnly: c.programOnly,
          sortOrder: c.sortOrder,
          enrolments: c._count.enrollments,
        }))}
      />
    </>
  );
}
