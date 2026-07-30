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
    <main className="portal-page">
      <h1>Programs</h1>

      {children.length === 0 && (
        <div className="notice">
          <h2>Add a child first</h2>
          <p>
            Programs are registered per child. <Link href="/portal">Add your first child</Link>.
          </p>
        </div>
      )}

      {programs.length === 0 ? (
        <p className="muted">No programs are open right now.</p>
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
              <article key={program.id} className="panel">
                <h3>{program.title}</h3>
                {program.description && <p className="muted">{program.description}</p>}

                <dl className="facts">
                  {program.startDate && (
                    <div>
                      <dt>Starts</dt>
                      <dd>{dateFmt.format(program.startDate)}</dd>
                    </div>
                  )}
                  {program.ageRange && (
                    <div>
                      <dt>Ages</dt>
                      <dd>{program.ageRange}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Seats</dt>
                    <dd>
                      {left === null ? "Unlimited" : left === 0 ? "Full" : `${left} left`}
                    </dd>
                  </div>
                </dl>

                {mine.length > 0 && (
                  <p className="checkout__ok">
                    Registered: {mine.join(", ")}
                  </p>
                )}

                {closed ? (
                  <p className="muted">Registration has closed.</p>
                ) : left === 0 ? (
                  <p className="muted">Fully booked.</p>
                ) : bookable ? (
                  <CheckoutButton
                    kind="program"
                    itemId={program.id}
                    kids={kids}
                    label={program.priceKobo === 0 ? "Register" : "Register and pay"}
                    price={formatPrice(program.priceKobo)}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
