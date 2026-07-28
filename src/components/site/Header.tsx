"use client";

/**
 * Public site header.
 *
 * Two audiences arrive at codeearly.com: parents evaluating whether to enrol,
 * and existing members trying to get back to their portal. So the nav carries
 * both a marketing path and a visible way in — a sign-in link buried in a
 * hamburger is the fastest way to generate "how do I log in?" support messages.
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/courses", label: "Courses" },
  { href: "/programs", label: "Programs" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-logo" onClick={() => setOpen(false)}>
          <span className="site-logo__mark">&lt;/&gt;</span>
          <span className="site-logo__text">
            Code<span className="site-logo__accent">Early</span>
          </span>
        </Link>

        <button
          type="button"
          className="site-header__toggle"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden>{open ? "✕" : "☰"}</span>
        </button>

        <nav className={`site-nav ${open ? "site-nav--open" : ""}`}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              // aria-current tells a screen reader which page they are on;
              // colour alone would not.
              aria-current={pathname === link.href ? "page" : undefined}
              className={pathname === link.href ? "is-active" : ""}
            >
              {link.label}
            </Link>
          ))}

          <Link href="/login" className="site-nav__signin" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Link href="/register" className="btn btn--primary" onClick={() => setOpen(false)}>
            Join the club
          </Link>
        </nav>
      </div>
    </header>
  );
}
