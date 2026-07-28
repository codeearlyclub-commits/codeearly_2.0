import Link from "next/link";

/**
 * Public site footer.
 *
 * Carries the legal links that a service handling children's data is expected
 * to make easy to find, plus a real contact route. A parent deciding whether to
 * hand over their child's details should not have to hunt for who we are.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-logo__text">
            Code<span className="site-logo__accent">Early</span>
          </span>
          <p>
            Teaching children to code — courses, live classes, holiday programs
            and competitions for young learners.
          </p>
        </div>

        <nav className="site-footer__col" aria-label="Learn">
          <h3>Learn</h3>
          <Link href="/courses">Courses</Link>
          <Link href="/programs">Programs</Link>
          <Link href="/register">Join the club</Link>
        </nav>

        <nav className="site-footer__col" aria-label="Club">
          <h3>Club</h3>
          <Link href="/about">About us</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Member sign in</Link>
        </nav>

        <nav className="site-footer__col" aria-label="Legal">
          <h3>Legal</h3>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="mailto:info@codeearly.com">info@codeearly.com</a>
        </nav>
      </div>

      <div className="site-footer__bar">
        <p>© {year} CodeEarly Club. All rights reserved.</p>
        <p>Made for young coders in Nigeria and beyond.</p>
      </div>
    </footer>
  );
}
