/**
 * The admin's navigation, defined once.
 *
 * The rail, the command palette and the page-title bar all read from this. A
 * section added here appears in all three; there is no second list to forget.
 *
 * Plain data with no imports, so it can be used from a server layout and a
 * client component without dragging either into the other's bundle.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  /** Shown in the rail. Emoji rather than an icon font — no extra request. */
  icon: string;
  /** Extra words the command palette matches on. */
  keywords?: string[];
};

export type AdminNavGroup = { group: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    group: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "◈", keywords: ["home", "stats"] }],
  },
  {
    group: "Learning",
    items: [
      { href: "/admin/courses", label: "Courses", icon: "📚", keywords: ["lessons", "curriculum", "modules"] },
      { href: "/admin/programs", label: "Programs", icon: "🎓", keywords: ["cohort", "holiday", "bootcamp"] },
      { href: "/admin/records", label: "Reports & certificates", icon: "🏆", keywords: ["report card", "certificate", "award"] },
    ],
  },
  {
    group: "Live",
    items: [{ href: "/admin/competitions", label: "Quizzes", icon: "🎯", keywords: ["competition", "host", "game"] }],
  },
  {
    group: "People",
    items: [{ href: "/admin/members", label: "Members", icon: "👥", keywords: ["parents", "children", "families"] }],
  },
  {
    group: "Money",
    items: [{ href: "/admin/invoices", label: "Invoices", icon: "💳", keywords: ["payments", "paystack", "billing"] }],
  },
  {
    group: "Website",
    items: [
      { href: "/admin/blog", label: "Blog", icon: "📝", keywords: ["posts", "articles", "writing"] },
      { href: "/admin/showcase", label: "Showcase", icon: "🌟", keywords: ["projects", "student work"] },
      { href: "/admin/events", label: "Events", icon: "📅", keywords: ["open day", "rsvp", "attendees"] },
      { href: "/admin/testimonials", label: "Testimonials", icon: "💬", keywords: ["quotes", "reviews"] },
      { href: "/admin/faqs", label: "FAQs", icon: "❓", keywords: ["questions", "help"] },
      { href: "/admin/messages", label: "Enquiries", icon: "✉️", keywords: ["contact", "inbox", "messages"] },
      { href: "/admin/subscribers", label: "Newsletter", icon: "📮", keywords: ["subscribers", "mailing list"] },
    ],
  },
];

export const ADMIN_NAV_FLAT: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

/**
 * The most specific matching nav entry for a path.
 *
 * Longest-prefix rather than first-match: `/admin/courses/abc` must resolve to
 * Courses, and `/admin` must not swallow every route beneath it.
 */
export function currentNavItem(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV_FLAT) {
    const matches = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}
