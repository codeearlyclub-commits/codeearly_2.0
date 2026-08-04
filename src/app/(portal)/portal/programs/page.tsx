/**
 * Portal programs — register a child for a cohort.
 *
 * Availability is shown honestly, including when a program is full or closed,
 * and the button disappears rather than failing on submit. Selling a seat that
 * does not exist and refunding afterwards is worse than refusing the sale.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPublicPrograms } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";
import { CheckoutButton } from "@/components/portal/CheckoutButton";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function PortalProgramsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const parentId = session.user.id;

  const [children, programs, registrations] = await Promise.all([
    prisma.child.findMany({
      where: { parentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, childName: true },
    }),
    listPublicPrograms(),
    prisma.programEnrollment.findMany({
      where: { child: { parentId }, status: "active" },
      select: { programId: true, child: { select: { childName: true } } },
    }),
  ]);

  const kids = children.map((c) => ({ id: c.id, name: c.childName }));
  const registeredBy = new Map<string, string[]>();
  for (const r of registrations) {
    registeredBy.set(r.programId, [
      ...(registeredBy.get(r.programId) ?? []),
      r.child.childName,
    ]);
  }

  return (
    <>
      <header className="portal-head">
        <h1>Programs</h1>
        <p>Live classes in a small group, over a fixed few weeks.</p>
      </header>

      {children.length === 0 && (
        <div className="pnotice pnotice--warn">
          <h2>Add a child first</h2>
          <p>Programs are registered per child, so we need to know who is coming.</p>
          <Link className="pbtn pbtn--primary" href="/portal">
            Add a child →
          </Link>
        </div>
      )}

      {programs.length === 0 ? (
        <div className="pempty">
          <div className="pempty__icon">🗓️</div>
          <h3>No programs are open right now</h3>
          <p>
            We run these around school holidays. Have a look at{" "}
            <Link href="/portal/courses">the self-paced courses</Link> in the meantime.
          </p>
        </div>
      ) : (
        <div className="portal-grid">
          {programs.map((program) => {
            const left =
              program.capacity === null
                ? null
                : Math.max(0, program.capacity - program._count.enrollments);
            const closed =
              program.registrationDeadline !== null &&
              program.registrationDeadline < new Date();
            const mine = registeredBy.get(program.id) ?? [];
            const bookable = !closed && left !== 0 && children.length > 0;

            return (
              <article className="pcard" key={program.id}>
                <div
                  style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}
                >
                  <span className="ppill">{program.type}</span>
                  {left !== null && left > 0 && left <= 5 && (
                    <span className="ppill ppill--pending">only {left} left</span>
                  )}
                  {closed && <span className="ppill ppill--muted">closed</span>}
                  {left === 0 && <span className="ppill ppill--failed">full</span>}
                </div>

                <h3
                  style={{
                    fontFamily: "var(--font-nunito), sans-serif",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    color: "var(--navy)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {program.title}
                </h3>

                {program.description && (
                  <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.65 }}>
                    {program.description.length > 160
                      ? `${program.description.slice(0, 160).trimEnd()}…`
                      : program.description}
                  </p>
                )}

                <div className="child-card__figures" style={{ marginTop: "0.9rem" }}>
                  <div className="child-card__figure">
                    <b style={{ fontSize: "0.95rem" }}>
                      {program.startDate ? dateFmt.format(program.startDate).split(" ").slice(0, 2).join(" ") : "TBC"}
                    </b>
                    <span>starts</span>
                  </div>
                  <div className="child-card__figure">
                    <b style={{ fontSize: "0.95rem" }}>{program.ageRange ?? "All"}</b>
                    <span>ages</span>
                  </div>
                  <div className="child-card__figure">
                    <b style={{ fontSize: "0.95rem" }}>
                      {left === null ? "∞" : left}
                    </b>
                    <span>seats left</span>
                  </div>
                </div>

                {mine.length > 0 && (
                  <p
                    className="pnotice pnotice--good"
                    style={{ margin: "0.9rem 0 0", padding: "0.6rem 0.85rem", fontSize: "0.85rem" }}
                  >
                    Registered: <b>{mine.join(", ")}</b>
                  </p>
                )}

                <div style={{ marginTop: "0.9rem" }}>
                  {closed ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                      Registration has closed.
                    </p>
                  ) : left === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                      Fully booked — <Link href="/contact">ask about the next one</Link>.
                    </p>
                  ) : bookable ? (
                    <CheckoutButton
                      kind="program"
                      itemId={program.id}
                      kids={kids}
                      label={program.priceKobo === 0 ? "Register" : "Register and pay"}
                      price={formatPrice(program.priceKobo)}
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
