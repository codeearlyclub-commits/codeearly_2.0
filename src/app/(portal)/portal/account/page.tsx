/**
 * Parent account.
 *
 * Everything about the account in one place. Password change and email change
 * are not built yet — rather than hide that, the rows say so plainly, because a
 * parent hunting for a missing button is worse served than one who is told.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const [childCount, subscription] = await Promise.all([
    prisma.child.count({ where: { parentId: session.user.id } }),
    prisma.subscription.findFirst({
      where: { parentId: session.user.id, status: "active" },
      orderBy: { endDate: "desc" },
      select: { planName: true, endDate: true, scope: true },
    }),
  ]);

  const verified = Boolean(session.user.emailVerified);

  return (
    <>
      <header className="portal-head">
        <h1>Your account</h1>
        <p>Who you are, what you are subscribed to, and how to leave.</p>
      </header>

      <section className="portal-section">
        <div className="pcard">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div
              className="child-card__avatar"
              style={{ width: 56, height: 56, fontSize: "1.4rem" }}
            >
              {(session.user.name || session.user.email).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-nunito), sans-serif",
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  color: "var(--navy)",
                }}
              >
                {session.user.name}
              </div>
              <div style={{ fontSize: "0.88rem", color: "var(--muted)" }}>
                {session.user.email}
              </div>
            </div>
          </div>

          <div className="prow" style={{ border: 0, padding: "0.6rem 0" }}>
            <div className="prow__main">
              <div className="prow__title">Email address</div>
              <div className="prow__sub">
                {verified ? "Confirmed" : "Not confirmed — check your inbox"}
              </div>
            </div>
            <span className={verified ? "ppill ppill--paid" : "ppill ppill--pending"}>
              {verified ? "verified" : "unverified"}
            </span>
          </div>

          <div className="prow" style={{ border: 0, padding: "0.6rem 0" }}>
            <div className="prow__main">
              <div className="prow__title">Children</div>
              <div className="prow__sub">
                {childCount} on your account
              </div>
            </div>
            <Link className="pbtn" href="/portal">
              Manage
            </Link>
          </div>
        </div>
      </section>

      <section className="portal-section">
        <div className="portal-section__head">
          <h2>Membership</h2>
        </div>
        {subscription ? (
          <div className="money-strip">
            <div className="money-strip__main">
              <div className="money-strip__label">{subscription.scope.replace("_", " ")}</div>
              <div className="money-strip__value">{subscription.planName}</div>
              <div className="money-strip__note">
                Renews {dateFmt.format(subscription.endDate)}
              </div>
            </div>
            <Link className="pbtn" href="/portal/invoices">
              Invoices
            </Link>
          </div>
        ) : (
          <div className="pcard">
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: 0 }}>
              No active membership. Courses can still be bought individually — a
              membership just makes it cheaper if you are doing more than one.
            </p>
          </div>
        )}
      </section>

      <section className="portal-section">
        <div className="portal-section__head">
          <h2>Security</h2>
        </div>
        <div className="pcard">
          <div className="prow" style={{ border: 0, padding: "0.6rem 0" }}>
            <div className="prow__main">
              <div className="prow__title">Password</div>
              {/* Said plainly rather than hidden. A parent looking for this button
                  and not finding it assumes the site is broken. And it points at
                  something that actually exists — self-service reset does not yet,
                  so promising it here would be worse than saying nothing. */}
              <div className="prow__sub">
                Changing your password from here is coming shortly.{" "}
                <Link href="/contact">Message us</Link> and we&apos;ll reset it for you.
              </div>
            </div>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <SignOutButton />
          </div>
        </div>
      </section>
    </>
  );
}
