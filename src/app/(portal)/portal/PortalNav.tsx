"use client";

/**
 * Portal navigation — one definition, two renderings.
 *
 * Desktop gets a horizontal bar; phones get a bottom tab bar, because that is
 * where thumbs are and parents overwhelmingly open this on a phone. Both read
 * from the same list, so a link cannot exist in one and be forgotten in the
 * other.
 *
 * Client-side only because it needs `usePathname` to mark the current tab.
 * Nothing else about the shell needs JavaScript.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string; short?: string };

export const PORTAL_NAV: NavItem[] = [
  { href: "/portal", label: "Home", icon: "🏠" },
  { href: "/portal/courses", label: "Courses", icon: "📚" },
  { href: "/portal/programs", label: "Programs", icon: "🎓" },
  { href: "/portal/records", label: "Reports", icon: "🏆" },
  { href: "/portal/invoices", label: "Payments", icon: "💳" },
];

/**
 * `/portal` must match exactly. Prefix-matching it would light up Home on every
 * page in the portal, which makes the whole bar useless.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * There is deliberately NO link to /admin here.
 *
 * The portal is the parent product and the admin is the staff tool; they are
 * different applications that happen to share a sign-in. Advertising one from
 * the other blurs which surface you are on — and it put a one-click route from a
 * family's screen into the staff tool, on a laptop children use. Staff reach the
 * admin through /staff.
 */
export function PortalNavBar() {
  const pathname = usePathname();

  return (
    <nav className="portal-bar__nav">
      {PORTAL_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isCurrent(pathname, item.href) ? "is-current" : undefined}
        >
          {item.label}
        </Link>
      ))}
      <Link href="/portal/account" className={pathname === "/portal/account" ? "is-current" : undefined}>
        Account
      </Link>
    </nav>
  );
}

export function PortalTabs() {
  const pathname = usePathname();

  return (
    <nav className="portal-tabs" aria-label="Portal sections">
      {PORTAL_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={isCurrent(pathname, item.href) ? "is-current" : undefined}
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          <span className="portal-tabs__icon" aria-hidden>
            {item.icon}
          </span>
          {item.short ?? item.label}
        </Link>
      ))}
    </nav>
  );
}
