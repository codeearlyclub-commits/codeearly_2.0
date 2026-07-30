import Link from "next/link";
import Image from "next/image";

/**
 * Public footer — ported from the live V4 site.
 *
 * Markup and class names match V4's so `site-v4.css` styles it identically. The
 * real social URLs and the "Powered by Dev Academy" line are kept, since those
 * are the actual site, not placeholders.
 *
 * Links point at pages that exist in 2.0. Where a V4 page has not been built
 * yet, the link is simply absent rather than left to 404 — a footer full of dead
 * links reads as a broken site.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer>
      <div className="footer-grid">
        <div>
          <Link className="footer-logo" href="/">
            <Image
              src="/logo-codeearly.png"
              alt="CodeEarly Club"
              width={56}
              height={34}
              className="footer-logo-image"
              style={{ width: "auto", height: "34px" }}
            />
          </Link>
          <p className="footer-desc">
            Empowering African kids aged 7 to 16 to code, create, and lead in the
            digital world.
          </p>
          <div className="footer-socials">
            <a
              className="social-link"
              href="https://www.facebook.com/codeearlyng"
              aria-label="Facebook"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a
              className="social-link"
              href="https://twitter.com/code_early"
              aria-label="X (Twitter)"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              className="social-link"
              href="https://www.instagram.com/codeearly_/"
              aria-label="Instagram"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </a>
            <a
              className="social-link"
              href="https://www.youtube.com/@codeearlyclub"
              aria-label="YouTube"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                <polygon fill="#fff" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
              </svg>
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Platform</h4>
          <ul className="footer-links">
            <li><Link href="/courses">Courses</Link></li>
            <li><Link href="/programs">Programs</Link></li>
            <li><Link href="/play">Join a Quiz</Link></li>
            <li><Link href="/register">Membership</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <ul className="footer-links">
            <li><Link href="/about">About us</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><Link href="/contact">Partner with us</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Legal</h4>
          <ul className="footer-links">
            <li><Link href="/privacy">Privacy Policy</Link></li>
            <li><Link href="/terms">Terms of Use</Link></li>
            <li><Link href="/login">Member Login</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copy">© {year} CodeEarly Club. All rights reserved.</p>
        <div className="footer-legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "10px 24px 18px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.04em",
          }}
        >
          Powered by{" "}
          <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
            Dev Academy
          </span>
        </span>
      </div>
    </footer>
  );
}
