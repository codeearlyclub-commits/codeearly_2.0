"use client";

/**
 * ⌘K command palette.
 *
 * Two sources, deliberately in this order:
 *
 *   1. NAVIGATION, matched locally and instantly. Most uses are "take me to
 *      invoices", and that should never wait on a network round trip.
 *   2. RECORDS, fetched from /api/admin/search after a short debounce.
 *
 * Local results appear immediately and records fill in underneath, so the list
 * never goes blank while typing — a palette that flashes empty feels broken even
 * when it is working.
 *
 * The request is aborted whenever the query changes. Without that, a slow reply
 * for "ad" can land after a fast reply for "ada" and overwrite it with staler
 * results, which looks like the search randomly forgetting what you typed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_NAV_FLAT, type AdminNavItem } from "./nav";

type Hit = {
  id: string;
  type: "child" | "parent" | "course" | "program" | "invoice" | "post";
  title: string;
  subtitle: string;
  href: string;
};

type Row = { key: string; title: string; subtitle: string; href: string; kind: string };

const TYPE_LABEL: Record<Hit["type"], string> = {
  child: "Child",
  parent: "Parent",
  course: "Course",
  program: "Program",
  invoice: "Invoice",
  post: "Post",
};

function matchesNav(item: AdminNavItem, q: string): boolean {
  const haystack = [item.label, ...(item.keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(q);
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /**
   * Results are stored WITH the query they belong to.
   *
   * That pairing is what lets the render decide whether they are still relevant
   * instead of an effect clearing them on every keystroke — no cascading render,
   * and a stale reply for "ad" can never be shown under "ada".
   */
  const [results, setResults] = useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setLoading(false);
    setOpen(true);
    // The dialog has to exist before it can take focus.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ⌘K / Ctrl+K anywhere in the admin.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => {
          if (was) return false;
          requestAnimationFrame(() => inputRef.current?.focus());
          return true;
        });
        setQuery("");
        setActive(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced record search, cancelled on every change.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { hits: Hit[] };
        setResults({ q, hits: body.hits ?? [] });
      } catch {
        // An aborted request is the normal case, not a failure worth reporting.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const rows: Row[] = useMemo(() => {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    const nav = (q ? ADMIN_NAV_FLAT.filter((i) => matchesNav(i, q)) : ADMIN_NAV_FLAT).map(
      (item): Row => ({
        key: `nav:${item.href}`,
        title: item.label,
        subtitle: item.href,
        href: item.href,
        kind: "Go to",
      })
    );

    // Only show records fetched for exactly what is in the box now.
    const fresh = results.q === trimmed ? results.hits : [];
    const records = fresh.map(
      (hit): Row => ({
        key: `${hit.type}:${hit.id}`,
        title: hit.title,
        subtitle: hit.subtitle,
        href: hit.href,
        kind: TYPE_LABEL[hit.type],
      })
    );

    return [...nav, ...records];
  }, [query, results]);

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      setOpen(false);
      router.push(row.href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        className="cmdk-trigger"
        onClick={openPalette}
        aria-label="Search — Command K"
      >
        <span aria-hidden>🔍</span>
        <span className="cmdk-trigger__text">Search…</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div
          className="cmdk"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="cmdk__box">
            <input
              ref={inputRef}
              className="cmdk__input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Search children, parents, courses, invoices…"
              aria-label="Search"
              autoComplete="off"
            />

            <div className="cmdk__results">
              {rows.length === 0 ? (
                <p className="cmdk__empty">
                  {loading ? "Searching…" : `Nothing matches “${query}”.`}
                </p>
              ) : (
                <ul>
                  {rows.map((row, i) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        className={i === active ? "cmdk__row is-active" : "cmdk__row"}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(row)}
                      >
                        <span className="cmdk__kind">{row.kind}</span>
                        <span className="cmdk__title">{row.title}</span>
                        <span className="cmdk__sub">{row.subtitle}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cmdk__foot">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
              {loading && <span>searching…</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
