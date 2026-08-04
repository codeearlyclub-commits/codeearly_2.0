/**
 * Parent portal — the dashboard.
 *
 * WHAT THIS PAGE IS FOR
 *
 * A parent opens this to answer one of three questions: how is my child doing,
 * do I owe anything, what is happening next. So those are the three things on
 * it, in that order, and nothing competes with them.
 *
 * The gamified treatment — XP, levels, streaks — deliberately lives on the
 * CHILD's screen at /me instead. It motivates a nine-year-old. To a parent
 * deciding whether this is worth the money it is noise on top of the numbers
 * they actually want: lessons finished, time spent, certificates earned.
 *
 * A server component: it calls the domain service directly rather than fetching
 * its own API over HTTP. Same rules either way, because the rules live in
 * `src/server/*` and both entry points call into them.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getPortalOverview } from "@/server/members/overview";
import { formatPrice } from "@/lib/money";
import { ChildrenPanel } from "./ChildrenPanel";

export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("en-NG", { month: "short" });
const dayTimeFmt = new Intl.DateTimeFormat("en-NG", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

/**
 * A stable colour per child, derived from their id.
 *
 * Not random: a child keeps the same colour on every visit and on every device,
 * which is what makes the avatar useful for telling two children apart at a
 * glance rather than just decorative.
 */
const KID_COLOURS = [
  { bg: "var(--green-light)", fg: "var(--green-dark)" },
  { bg: "var(--sky-light)", fg: "var(--blue-mid)" },
  { bg: "var(--purple-light)", fg: "var(--purple)" },
  { bg: "var(--orange-light)", fg: "#b45309" },
  { bg: "var(--pink-light)", fg: "#be185d" },
];

function kidColour(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return KID_COLOURS[hash % KID_COLOURS.length]!;
}

function sinceLabel(date: Date | null): string {
  if (!date) return "Not started yet";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Learning today";
  if (days === 1) return "Last active yesterday";
  if (days < 7) return `Last active ${days} days ago`;
  if (days < 30) return `Last active ${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return `Last active ${dateFmt.format(date)}`;
}

export default async function PortalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const verified = Boolean(session.user.emailVerified);
  const firstName = (session.user.name || "there").split(" ")[0];

  // An unverified parent gets nothing but the instruction to check their email.
  // Loading their (empty) dashboard underneath would just be noise.
  if (!verified) {
    return (
      <>
        <header className="portal-head">
          <h1>Hi {firstName}</h1>
        </header>

        <div className="pnotice pnotice--warn">
          <h2>Confirm your email first</h2>
          <p>
            We sent a link to <b>{session.user.email}</b>. Click it to unlock adding
            children, enrolling and payments.
          </p>
          <p>
            Nothing has gone wrong — this just stops someone else signing up with your
            address.
          </p>
        </div>
      </>
    );
  }

  const overview = await getPortalOverview(session.user.id);
  const { children, money, upcoming } = overview;

  return (
    <>
      <header className="portal-head">
        <h1>Hi {firstName}</h1>
        <p>
          {children.length === 0
            ? "Let's get your first child set up."
            : `${children.length} child${children.length === 1 ? "" : "ren"} in the club.`}
        </p>
      </header>

      {/* ── Money ────────────────────────────────────────────────────────────
          First, and only when there is something to say. A parent who owes
          nothing should not be shown a zero — it reads like a bill. */}
      {money.unpaidCount > 0 && (
        <div className="money-strip money-strip--owing" style={{ marginBottom: "1.75rem" }}>
          <div className="money-strip__main">
            <div className="money-strip__label">Outstanding</div>
            <div className="money-strip__value">{formatPrice(money.unpaidKobo)}</div>
            <div className="money-strip__note">
              {money.unpaidCount} unpaid invoice{money.unpaidCount === 1 ? "" : "s"}
              {money.oldestUnpaid
                ? ` · oldest ${money.oldestUnpaid.invoiceNumber} from ${dateFmt.format(
                    money.oldestUnpaid.createdAt
                  )}`
                : ""}
            </div>
          </div>
          <Link className="pbtn pbtn--primary" href="/portal/invoices">
            Pay now →
          </Link>
        </div>
      )}

      {/* ── Children ─────────────────────────────────────────────────────── */}
      <section className="portal-section">
        <div className="portal-section__head">
          <h2>Your children</h2>
        </div>

        {children.length === 0 ? (
          <div className="pempty">
            <div className="pempty__icon">👋</div>
            <h3>Add your first child</h3>
            <p>
              Each child gets a profile under your account — no email address needed
              for them. Once they are added you can enrol them and give them their own
              sign-in code.
            </p>
          </div>
        ) : (
          <div className="child-cards">
            {children.map((child) => {
              const colour = kidColour(child.id);
              return (
                <article
                  className="child-card"
                  key={child.id}
                  style={
                    {
                      "--kid-bg": colour.bg,
                      "--kid-fg": colour.fg,
                    } as React.CSSProperties
                  }
                >
                  <div className="child-card__top">
                    <div className="child-card__avatar">
                      {child.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="child-card__name">{child.name}</div>
                      <div className="child-card__id">
                        {child.membershipId} · {sinceLabel(child.lastActiveAt)}
                      </div>
                    </div>
                  </div>

                  {child.current ? (
                    <div className="child-card__current">
                      <div className="child-card__current-title">
                        <span
                          style={{
                            color: "var(--navy)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {child.current.title}
                        </span>
                        <span>{child.current.percent}%</span>
                      </div>
                      <div className="pbar">
                        <div className="pbar__fill" style={{ width: `${child.current.percent}%` }} />
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
                      {child.coursesEnrolled === 0
                        ? "Not enrolled on anything yet."
                        : child.coursesCompleted > 0
                          ? "All caught up — nothing in progress."
                          : "Enrolled, but has not started a lesson yet."}
                    </p>
                  )}

                  <div className="child-card__figures">
                    <div className="child-card__figure">
                      <b>{child.lessonsCompleted}</b>
                      <span>lesson{child.lessonsCompleted === 1 ? "" : "s"}</span>
                    </div>
                    <div className="child-card__figure">
                      <b>{child.minutesLearning}</b>
                      <span>minutes</span>
                    </div>
                    <div className="child-card__figure">
                      <b>{child.certificates}</b>
                      <span>certificate{child.certificates === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="child-card__actions">
                    <Link className="pbtn" href={`/portal/records?childId=${child.id}`}>
                      Reports {child.reports > 0 ? `(${child.reports})` : ""}
                    </Link>
                    <Link className="pbtn" href="/portal/courses">
                      Enrol
                    </Link>
                    {!child.loginEnabled && (
                      <span className="ppill ppill--muted" title="No sign-in code issued yet">
                        no sign-in
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── What's next ──────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="portal-section">
          <div className="portal-section__head">
            <h2>Coming up</h2>
            <Link href="/portal/programs">All programs →</Link>
          </div>
          <div className="pcard">
            <ul className="ptimeline">
              {upcoming.map((session) => (
                <li key={session.id}>
                  <div className="ptimeline__date">
                    <span className="ptimeline__month">{monthFmt.format(session.date)}</span>
                    <span className="ptimeline__day">{session.date.getDate()}</span>
                  </div>
                  <div className="ptimeline__main">
                    <div className="ptimeline__title">{session.title}</div>
                    <div className="ptimeline__sub">
                      {session.programTitle} · {session.childName} ·{" "}
                      {dayTimeFmt.format(session.date)}
                    </div>
                  </div>
                  {session.virtualLink && (
                    <a
                      className="pbtn pbtn--primary"
                      href={session.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Join
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Membership ───────────────────────────────────────────────────── */}
      {money.subscriptionActive && money.subscriptionEndsAt && (
        <section className="portal-section">
          <div className="money-strip">
            <div className="money-strip__main">
              <div className="money-strip__label">Membership</div>
              <div className="money-strip__value">Active</div>
              <div className="money-strip__note">
                Renews {dateFmt.format(money.subscriptionEndsAt)}
              </div>
            </div>
            <Link className="pbtn" href="/portal/account">
              Manage
            </Link>
          </div>
        </section>
      )}

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <section className="portal-section">
        <div className="portal-section__head">
          <h2>Quick actions</h2>
        </div>
        <div className="quick-grid">
          <Link className="quick-btn" href="/portal/courses">
            <span className="quick-btn__icon" aria-hidden>
              📚
            </span>
            Enrol on a course
          </Link>
          <Link className="quick-btn" href="/portal/programs">
            <span className="quick-btn__icon" aria-hidden>
              🎓
            </span>
            Join a program
          </Link>
          <Link className="quick-btn" href="/portal/records">
            <span className="quick-btn__icon" aria-hidden>
              🏆
            </span>
            Reports &amp; certificates
          </Link>
          <Link className="quick-btn" href="/contact">
            <span className="quick-btn__icon" aria-hidden>
              💬
            </span>
            Ask us something
          </Link>
        </div>
      </section>

      {/* ── Manage children ──────────────────────────────────────────────── */}
      <ChildrenPanel
        initialChildren={children.map((c) => ({
          id: c.id,
          name: c.name,
          membershipId: c.membershipId,
          studentLoginEnabled: c.loginEnabled,
        }))}
      />
    </>
  );
}
