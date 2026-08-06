/**
 * 404.
 *
 * There was no not-found page at all, so every wrong URL — a mistyped course
 * slug, an old link from V4, a child fat-fingering the address bar — got Next's
 * bare black-on-white default. This is also what the admin host serves for any
 * path that is not the admin, so it has to look like the site rather than like
 * a stack trace.
 *
 * Deliberately links only to things that exist for everyone. A child who lands
 * here must not be sent to a page asking for an email address.
 */
import type { Metadata } from "next";
import Link from "next/link";

import "@/styles/auth.css";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="auth">
      <Logo height={40} className="auth__brand" />

      <div className="auth__card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", lineHeight: 1, marginBottom: "0.75rem" }} aria-hidden>
          🧭
        </div>
        <h1>We can&apos;t find that page</h1>
        <p className="auth__lede">
          The link may be out of date, or the address may have a typo in it.
        </p>

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="auth__submit" href="/" style={{ textDecoration: "none" }}>
            Back to the site
          </Link>
        </div>

        <div className="auth__alt" style={{ textAlign: "left" }}>
          <span>
            Looking for your child&apos;s lessons? <Link href="/student">Sign in with a code</Link>
          </span>
          <span>
            Looking for your account? <Link href="/login">Sign in</Link>
          </span>
          <span>
            Something we broke? <Link href="/contact">Tell us</Link>
          </span>
        </div>
      </div>
    </main>
  );
}
