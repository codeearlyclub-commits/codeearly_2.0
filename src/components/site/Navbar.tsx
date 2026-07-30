"use client";

/**
 * Public navbar — ported from the live V4 site so returning parents recognise it.
 *
 * The class names and markup match V4's exactly, because `site-v4.css` styles
 * them. What changed is the plumbing underneath:
 *
 *  - The session comes from Better Auth's `useSession` instead of a bespoke
 *    /api/member/me fetch. Still client-side, and for the same reason V4 did it:
 *    reading cookies in the layout would force every public page to render
 *    per-request and defeat caching.
 *  - Routes point at 2.0's actual pages (/login, /register) rather than V4's
 *    /portal/login and /membership?register=1.
 */
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Imported as the client object and called as `authClient.useSession()`. A
// destructured `useSession` import fails during SSR with "Invalid hook call" —
// the hook loses its binding to Better Auth's client across the module boundary.
import { authClient } from "@/lib/auth-client";

const navItems = [
  { href: "/about", label: "About", page: "about" },
  { href: "/courses", label: "Courses", page: "courses" },
  { href: "/programs", label: "Programs", page: "programs" },
  { href: "/showcase", label: "Showcase", page: "showcase" },
  { href: "/blog", label: "Blog", page: "blog" },
  { href: "/contact", label: "Contact", page: "contact" },
];

const eventsDropdown = [
  { href: "/events", label: "All Events" },
  { href: "/play", label: "Join a Quiz" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isEventsActive(pathname: string) {
  return pathname.startsWith("/events") || pathname.startsWith("/play");
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { data: session } = authClient.useSession();
  const member = session?.user ?? null;

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut().catch(() => {});
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!eventsOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest(".nav-dropdown-wrap")) setEventsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [eventsOpen]);

  return (
    <nav
      id="_nav"
      className={`public-navbar${open ? " menu-open" : ""}${scrolled ? " scrolled" : ""}`}
    >
      <Link
        className="nav-logo"
        href="/"
        aria-label="CodeEarly Club home"
        onClick={() => setOpen(false)}
      >
        <Image
          src="/logo-codeearly.png"
          alt="CodeEarly Club"
          width={66}
          height={40}
          className="public-navbar-logo-image"
          style={{ width: "auto", height: "40px" }}
          priority
        />
      </Link>

      <ul className="nav-links" id="_navLinks">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              data-p={item.page}
              className={isActive(pathname, item.href) ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          </li>
        ))}

        <li className="nav-dropdown-wrap">
          <button
            className={`nav-dropdown-trigger${isEventsActive(pathname) ? " active" : ""}`}
            onClick={() => setEventsOpen((v) => !v)}
            aria-expanded={eventsOpen}
            aria-haspopup="true"
            type="button"
          >
            Events
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              aria-hidden="true"
              style={{
                transition: "transform 0.2s",
                transform: eventsOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <path
                d="M2 3.5l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {eventsOpen && (
            <ul className="nav-dropdown">
              {eventsDropdown.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={isActive(pathname, item.href) ? "active" : undefined}
                    onClick={() => {
                      setEventsOpen(false);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Mobile: the same links, flattened, shown when the menu is open. */}
          <ul className="nav-dropdown-mobile">
            {eventsDropdown.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={isActive(pathname, item.href) ? "active" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </li>

        {member ? (
          <li className="nav-auth-group">
            <Link className="nav-cta" href="/portal" onClick={() => setOpen(false)}>
              My Portal
            </Link>
            <button
              className="nav-signout"
              onClick={signOut}
              disabled={signingOut}
              type="button"
            >
              {signingOut ? "…" : "Sign out"}
            </button>
          </li>
        ) : (
          <li className="nav-auth-group">
            <Link className="nav-cta-secondary" href="/login" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <Link className="nav-cta" href="/register" onClick={() => setOpen(false)}>
              Join the Club
            </Link>
          </li>
        )}
      </ul>

      <button
        className={open ? "nav-mobile-toggle open" : "nav-mobile-toggle"}
        type="button"
        aria-label="Menu"
        aria-controls="_navLinks"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
    </nav>
  );
}
