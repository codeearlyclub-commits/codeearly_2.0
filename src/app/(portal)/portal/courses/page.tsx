/**
 * Portal courses — what each child is enrolled in, and what they could join.
 *
 * Enrolled courses are shown per child rather than as one merged list. A parent
 * with two children needs to know which of them has the Python course, and a
 * combined list cannot answer that.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPublicCourses } from "@/server/courses/catalog";
import { hasActiveSubscription } from "@/server/payments/subscriptions";
import { formatPrice } from "@/lib/money";
import { CheckoutButton } from "@/components/portal/CheckoutButton";

export const dynamic = "force-dynamic";

export default async function PortalCoursesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const parentId = session.user.id;

  const [children, courses, subscribed] = await Promise.all([
    prisma.child.findMany({
      where: { parentId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        childName: true,
        enrollments: {
          select: { enrolledAt: true, course: { select: { id: true, title: true, slug: true, level: true } } },
        },
      },
    }),
    listPublicCourses(),
    hasActiveSubscription(parentId),
  ]);

  const kids = children.map((c) => ({ id: c.id, name: c.childName }));
  const enrolledIds = new Set(
    children.flatMap((c) => c.enrollments.map((e) => e.course.id))
  );

  return (
    <main className="portal-page">
      <h1>Courses</h1>

      {children.length === 0 ? (
        <div className="notice">
          <h2>Add a child first</h2>
          <p>
            Courses are enrolled per child. <Link href="/portal">Add your first child</Link>.
          </p>
        </div>
      ) : (
        <>
          {children.map((child) => (
            <section key={child.id} className="panel">
              <h2>{child.childName}</h2>
              {child.enrollments.length === 0 ? (
                <p className="muted">Not enrolled in anything yet.</p>
              ) : (
                <ul className="enrolled">
                  {child.enrollments.map((e) => (
                    <li key={e.course.id}>
                      <b>{e.course.title}</b>
                      {e.course.level && <span className="pill">{e.course.level}</span>}
                      <span className="muted">
                        since {e.enrolledAt.toLocaleDateString("en-NG")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <h2 className="portal-page__sub">Available courses</h2>
          <div className="portal-grid">
            {courses.map((course) => {
              const everyoneHasIt =
                enrolledIds.has(course.id) && children.length === 1;
              const covered = course.requiresSubscription && subscribed;

              return (
                <article key={course.id} className="panel">
                  <h3>{course.title}</h3>
                  {course.description && <p className="muted">{course.description}</p>}
                  <p className="muted">
                    {course.ageRange && <>Ages {course.ageRange} · </>}
                    {course.level}
                  </p>

                  {everyoneHasIt ? (
                    <p className="checkout__ok">Already enrolled</p>
                  ) : (
                    <CheckoutButton
                      kind="course"
                      itemId={course.id}
                      kids={kids}
                      label={
                        covered || course.priceKobo === 0 ? "Enrol" : "Enrol and pay"
                      }
                      price={
                        covered
                          ? "Included in your membership"
                          : formatPrice(course.priceKobo)
                      }
                    />
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
