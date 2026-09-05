import Link from "next/link";

import { Logo } from "@/components/brand/Logo";

/**
 * The bar across the top of every child screen.
 *
 * It exists because there was nothing. A child could open a course, find it had
 * no lessons yet, and be stuck: that page's only call to action is a `<span>`
 * when there is nothing to start, so the sole way out was the browser's back
 * button. Sign out was a form at the bottom of `/me`, below everything else.
 *
 * Deliberately NOT a set of tabs like the parent portal has. There is exactly
 * one destination — `/me` — because report cards, tasks and quiz history are not
 * built yet. A row of tabs where every tab goes to the same place is worse than
 * a logo that goes home, and it would have to be dismantled the moment those
 * pages land. This grows into tabs when there is somewhere to tab to.
 *
 * A server component: the whole thing is two links and a form post, and a child
 * on a school laptop should not wait on JavaScript to be able to leave a page.
 */
export function LearnNav({
  displayName,
  membershipId,
}: {
  displayName: string;
  membershipId: string;
}) {
  return (
    <header className="learn-bar">
      <div className="learn-bar__inner">
        {/* The bar is navy, so the logo takes its light chip. */}
        <Logo href="/me" height={28} onDark className="learn-bar__brand" priority />

        <nav className="learn-bar__nav" aria-label="Learning">
          <Link href="/me">My learning</Link>
        </nav>

        <div className="learn-bar__who">
          {/* First name only. The bar is narrow on a phone, and a child knows
              which name is theirs. The membership ID is the thing staff ask for,
              so it stays visible on wider screens. */}
          <span className="learn-bar__name">{displayName.split(" ")[0]}</span>
          <span className="learn-bar__member">{membershipId}</span>
          <form action="/api/student/logout" method="post">
            <button type="submit" className="learn-bar__out">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
