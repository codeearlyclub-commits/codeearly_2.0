/**
 * Portal courses — what each child is enrolled in, and what they could join.
 *
 * Enrolled courses are shown per child rather than as one merged list. A parent
 * with two children needs to know which of them has the Python course, and a
 * combined list cannot answer that.
 *
 * The catalogue below is filtered to what is actually joinable: a course every
 * child already has is dropped rather than shown with a disabled button, because
 * a wall of greyed-out cards makes the page look broken.
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

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

const courseIcons = ["🐱", "🌐", "🎨", "💡", "⚡", "🐍", "🤖", "🎮", "📱"];

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
          select: {
            enrolledAt: true,
            course: { select: { id: true, title: true, slug: true, level: true } },
          },
        },
      },
    }),
    listPublicCourses(),
    hasActiveSubscription(parentId),
  ]);

  const kids = children.map((c) => ({ id: c.id, name: c.childName }));

  // A course is "fully taken" only when EVERY child already has it. With two
  // children and one enrolled, it must stay on offer for the other.
  const enrolmentCount = new Map<string, number>();
  for (const child of children) {
    for (const e of child.enrollments) {
      enrolmentCount.set(e.course.id, (enrolmentCount.get(e.course.id) ?? 0) + 1);
    }
  }
  const joinable = courses.filter(
    (course) => (enrolmentCount.get(course.id) ?? 0) < children.length
  );

  if (children.length === 0) {
    return (
      <>
        <header className="portal-head">
          <h1>Courses</h1>
        </header>
        <div className="pempty">
          <div className="pempty__icon">👶</div>
          <h3>Add a child first</h3>
          <p>Courses are enrolled per child, so we need to know who is learning.</p>
          <Link className="pbtn pbtn--primary" href="/portal">
            Add a child →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="portal-head">
        <h1>Courses</h1>
        <p>What each child is working through, and what else they can join.</p>
      </header>

      {children.map((child) => (
        <section className="portal-section" key={child.id}>
          <div className="portal-section__head">
            <h2>{child.childName}</h2>
            <span className="ppill ppill--muted">
              {child.enrollments.length} enrolled
            </span>
          </div>

          {child.enrollments.length === 0 ? (
            <div className="pcard">
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
                Not enrolled in anything yet — pick something from below.
              </p>
            </div>
          ) : (
            <div>
              {child.enrollments.map((e) => (
                <div className="prow" key={e.course.id}>
                  <div className="prow__main">
                    <div className="prow__title">{e.course.title}</div>
                    <div className="prow__sub">
                      Since {dateFmt.format(e.enrolledAt)}
                      {e.course.level ? ` · ${e.course.level}` : ""}
                    </div>
                  </div>
                  <div className="prow__end">
                    <Link className="pbtn" href={`/courses/${e.course.slug}`}>
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="portal-section">
        <div className="portal-section__head">
          <h2>Available courses</h2>
          <Link href="/courses">Browse the catalogue →</Link>
        </div>

        {joinable.length === 0 ? (
          <div className="pempty">
            <div className="pempty__icon">🎉</div>
            <h3>Every child is on every course</h3>
            <p>
              There is nothing left to enrol on right now. New courses are added
              through the year — we&apos;ll email you.
            </p>
          </div>
        ) : (
          <div className="portal-grid portal-grid--3">
            {joinable.map((course, i) => {
              const covered = course.requiresSubscription && subscribed;
              return (
                <article className="pcard" key={course.id}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }} aria-hidden>
                    {courseIcons[i % courseIcons.length]}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-nunito), sans-serif",
                      fontWeight: 800,
                      fontSize: "1.02rem",
                      color: "var(--navy)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {course.title}
                  </h3>
                  {course.description && (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
                      {course.description.length > 120
                        ? `${course.description.slice(0, 120).trimEnd()}…`
                        : course.description}
                    </p>
                  )}
                  <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0.6rem 0" }}>
                    {course.ageRange ? `Ages ${course.ageRange}` : null}
                    {course.ageRange && course.level ? " · " : null}
                    {course.level}
                  </p>

                  <CheckoutButton
                    kind="course"
                    itemId={course.id}
                    kids={kids}
                    label={covered || course.priceKobo === 0 ? "Enrol" : "Enrol and pay"}
                    price={
                      covered ? "Included in your membership" : formatPrice(course.priceKobo)
                    }
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
