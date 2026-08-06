"use client";

/**
 * The admin icon rail.
 *
 * Collapsed to icons by default, because staff learn this in a day and then
 * want the horizontal space for tables — which is the whole job here. It can be
 * pinned open, and that choice persists in localStorage so it survives a reload.
 *
 * Collapsed items keep a real accessible name via `title` plus visually-hidden
 * text: an icon-only nav that screen readers announce as "link, ◈" is not a
 * navigation, it is a puzzle.
 *
 * The pinned flag lives in localStorage, which is an external store the server
 * cannot see. `useSyncExternalStore` is the right tool rather than
 * useState+useEffect: it gives React an explicit server snapshot (collapsed) so
 * hydration cannot mismatch, and it subscribes to the browser's `storage` event,
 * so pinning the rail in one tab updates every other open tab too.
 */
import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/Logo";
import { ADMIN_NAV, type AdminNavItem } from "./nav";

const PIN_KEY = "codeearly.admin.railPinned";
/** `storage` only fires in OTHER tabs, so the pinning tab announces to itself. */
const PIN_EVENT = "codeearly:rail-pin";

function subscribeToPin(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PIN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PIN_EVENT, onChange);
  };
}

function readPin(): boolean {
  return window.localStorage.getItem(PIN_KEY) === "1";
}

/** Server render is always collapsed — there is no storage to read there. */
function serverPin(): boolean {
  return false;
}

function isCurrent(pathname: string, item: AdminNavItem): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminRail({
  email,
  unanswered,
}: {
  email: string;
  unanswered: number;
}) {
  const pathname = usePathname();
  const pinned = useSyncExternalStore(subscribeToPin, readPin, serverPin);

  const togglePin = useCallback(() => {
    window.localStorage.setItem(PIN_KEY, pinned ? "0" : "1");
    window.dispatchEvent(new Event(PIN_EVENT));
  }, [pinned]);

  return (
    <aside className={pinned ? "rail rail--open" : "rail"}>
      <div className="rail__top">
        {/* Two forms, swapped by CSS rather than by JS: the square mark when the
            rail is 68px wide, the full logo once it is pinned open. At 48px the
            wordmark is about six pixels tall and unreadable, so shrinking the
            real logo to fit is not an option. */}
        <Link href="/admin" className="rail__brand" title="CodeEarly admin">
          <span className="rail__mark">
            <Logo href={null} mark height={32} />
          </span>
          <span className="rail__wordmark">
            <Logo href={null} height={28} onDark />
            <small>admin</small>
          </span>
        </Link>
        <button
          type="button"
          className="rail__pin"
          onClick={togglePin}
          aria-pressed={pinned}
          title={pinned ? "Collapse the sidebar" : "Keep the sidebar open"}
        >
          {pinned ? "«" : "»"}
        </button>
      </div>

      <nav className="rail__nav">
        {ADMIN_NAV.map((section) => (
          <div className="rail__group" key={section.group}>
            <h2>{section.group}</h2>
            {section.items.map((item) => {
              const current = isCurrent(pathname, item);
              const badge = item.href === "/admin/messages" ? unanswered : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={current ? "rail__link is-current" : "rail__link"}
                  title={item.label}
                  aria-current={current ? "page" : undefined}
                >
                  <span className="rail__icon" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="rail__label">{item.label}</span>
                  {badge > 0 && <span className="rail__badge">{badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* No link back to the portal. The admin is a staff tool and the portal is
          the parent product; cross-linking them made it ambiguous which surface
          you were on. Signing out returns to the staff door. */}
      <div className="rail__foot">
        <form action="/api/admin/sign-out" method="post">
          <button type="submit" className="rail__link rail__signout" title="Sign out">
            <span className="rail__icon" aria-hidden>
              ⏻
            </span>
            <span className="rail__label">Sign out</span>
          </button>
        </form>
        <p className="rail__email" title={email}>
          {email}
        </p>
      </div>
    </aside>
  );
}
