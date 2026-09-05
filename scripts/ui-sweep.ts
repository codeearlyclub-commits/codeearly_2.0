/**
 * UI/UX sweep — drives a real browser over every surface, as every audience.
 *
 * This is a SURVEY, not a test suite. It does not assert what a page should look
 * like, because nobody has written that down yet. It visits each route as the
 * audience that is allowed to see it, at a desktop and a phone width, and
 * reports the things that are wrong no matter what the design turns out to be:
 * a page that errors, a console exception, an image that did not load, a layout
 * that scrolls sideways on a phone, a page with no heading, a screen with no way
 * to navigate off it.
 *
 * Dynamic routes are DISCOVERED by crawling the index pages rather than
 * hardcoded, so this keeps working when the seed data changes. A hardcoded slug
 * would rot in a week and then quietly sweep nothing.
 *
 *   npx tsx scripts/ui-sweep.ts
 *   npx tsx scripts/ui-sweep.ts --only=admin      (public|parent|child|admin)
 *
 * Output: a markdown report and one screenshot per route/viewport, written to
 * `.ui-sweep/` (gitignored). Written incrementally, so a run that dies halfway
 * still leaves usable findings.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

const BASE = process.env.UI_SWEEP_BASE ?? "http://localhost:3000";
const ADMIN_HOST = process.env.ADMIN_HOST;
const ADMIN_BASE = ADMIN_HOST ? `http://${ADMIN_HOST}:3000` : BASE;

const PARENT_EMAIL = process.env.UI_SWEEP_EMAIL ?? "admin@codeearly.com";
const PARENT_PASSWORD = process.env.UI_SWEEP_PASSWORD ?? "CodeEarly2026!";
const STUDENT_CODE = process.env.UI_SWEEP_CODE ?? "9DF7G2";
const STUDENT_PIN = process.env.UI_SWEEP_PIN ?? "2707";

const OUT = path.join(process.cwd(), ".ui-sweep");
const SHOTS = path.join(OUT, "shots");

/** Dev compiles each route on first hit, and this machine is slow. */
const NAV_TIMEOUT = 240_000;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

type Persona = "public" | "parent" | "child" | "admin";
type Viewport = (typeof VIEWPORTS)[number]["name"];

type Finding = {
  level: "error" | "warn" | "info";
  kind: string;
  detail: string;
};

type Result = {
  persona: Persona;
  route: string;
  url: string;
  viewport: Viewport;
  status: number | null;
  title: string;
  shot: string | null;
  findings: Finding[];
};

const results: Result[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Sign-in. Done over the API rather than the forms: the forms are one of the
// things being surveyed, and a sweep that cannot start because a button moved
// is useless. The sign-in PAGES are still visited as `public` routes below.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `base` is the ORIGIN THE COOKIE MUST BELONG TO, and passing the wrong one
 * fails silently in the worst possible way.
 *
 * The admin lives on its own hostname, which is the entire point of the split —
 * a session minted on `localhost` is not sent to `admin.localhost`. Signing in
 * against BASE and then sweeping the admin origin produced fifteen pages that
 * all returned 200, because each one redirected to /staff and the sign-in form
 * renders fine. Thirty warnings about an admin that was never actually opened.
 *
 * A 200 is not proof you are where you think you are. `assertLandedOn` below is
 * the guard that would have caught it.
 */
async function parentContext(browser: Browser, base = BASE): Promise<BrowserContext> {
  const ctx = await browser.newContext();

  /**
   * Signed in from INSIDE the page, not via `ctx.request`.
   *
   * Playwright's request API resolves hosts with Node's resolver, and on
   * Windows that does not reliably map `*.localhost` to loopback — it worked
   * for one run and then failed the next with ENOTFOUND admin.localhost,
   * killing the admin sweep. Chromium implements RFC 6761 and always resolves
   * it, so the browser does the sign-in and the cookie lands on the right
   * origin by construction.
   */
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  const status = await page.evaluate(
    async (creds) => {
      const r = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creds),
      });
      return r.status;
    },
    { email: PARENT_EMAIL, password: PARENT_PASSWORD }
  );
  await page.close();

  if (status < 200 || status >= 300) {
    throw new Error(`sign-in failed on ${base}: ${status}`);
  }
  return ctx;
}

/**
 * Fail loudly if a sweep is walking sign-in pages instead of the product.
 * Checked once per persona, before any route is judged.
 */
async function assertLandedOn(ctx: BrowserContext, url: string, mustNotMatch: RegExp) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(800);
    const landed = page.url();
    if (mustNotMatch.test(landed)) {
      throw new Error(`not signed in — ${url} landed on ${landed}. Sweep would be meaningless.`);
    }
    console.log(`  (authenticated: ${url} → ${landed})`);
  } finally {
    await page.close();
  }
}

async function childContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const res = await ctx.request.post(`${BASE}/api/student/login`, {
    data: { loginCode: STUDENT_CODE, pin: STUDENT_PIN },
    headers: { origin: BASE },
  });
  if (!res.ok()) throw new Error(`child sign-in failed: ${res.status()} ${await res.text()}`);
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// The per-page checks. Everything here is design-agnostic: these are wrong in
// any design, which is what makes them worth automating before the design is
// settled.
// ─────────────────────────────────────────────────────────────────────────────

/** `rgb(r, g, b)` / `rgba(...)` → channels plus alpha. */
function rgba(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/**
 * The colour actually behind an element, compositing translucent layers.
 *
 * Taking the first layer with any alpha at all is wrong, and wrong in the
 * direction that invents bugs: the staff sign-in card is
 * `rgba(255,255,255,0.04)` — a 4% white film over a near-black gradient — and
 * reading that as solid white reported its white heading as white-on-white at
 * 1:1. It is a correct, legible heading.
 *
 * `chain` runs child → ancestor, so composite from the far end back.
 */
function effectiveBackground(chain: string[]): [number, number, number] {
  const layers = chain.map(rgba).filter((c): c is [number, number, number, number] => c !== null);

  // Start at the deepest fully opaque layer; anything above it cannot show through.
  let baseIndex = layers.findIndex((l) => l[3] >= 1);
  if (baseIndex === -1) baseIndex = layers.length - 1;

  // The page itself, when nothing up the tree paints.
  let acc: [number, number, number] =
    layers[baseIndex] && layers[baseIndex][3] >= 1
      ? [layers[baseIndex][0], layers[baseIndex][1], layers[baseIndex][2]]
      : [255, 255, 255];

  for (let i = baseIndex - 1; i >= 0; i--) {
    const [r, g, b, a] = layers[i];
    if (a <= 0) continue;
    acc = [
      Math.round(r * a + acc[0] * (1 - a)),
      Math.round(g * a + acc[1] * (1 - a)),
      Math.round(b * a + acc[2] * (1 - a)),
    ];
  }
  return acc;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

async function inspect(page: Page, viewport: Viewport): Promise<Finding[]> {
  const findings: Finding[] = [];

  const dom = await page.evaluate(() => {
    const doc = document.documentElement;

    const brokenImages = Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute("src") ?? "(no src)")
      .slice(0, 6);

    // A page that scrolls sideways on a phone is a layout bug every time.
    // 2px of slack absorbs sub-pixel rounding.
    const overflowBy = doc.scrollWidth - doc.clientWidth;

    // Which element is actually causing it — otherwise the finding is unactionable.
    let widest: string | null = null;
    if (overflowBy > 2) {
      let worst = 0;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const r = el.getBoundingClientRect();
        if (r.right > worst) {
          worst = r.right;
          widest = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
        }
      }
    }

    const h1s = Array.from(document.querySelectorAll("h1")).map((h) => h.textContent?.trim() ?? "");

    // "Can you get anywhere from here?" — links that leave the current page.
    const here = location.pathname;
    const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/") && h !== here);

    const inNav = document.querySelectorAll("nav a[href], header a[href]").length;

    const bodyText = (document.body.innerText ?? "").trim();

    /**
     * Heading colour, and every background colour above it.
     *
     * NO HELPER FUNCTIONS IN HERE. tsx compiles this body with esbuild's
     * keepNames, which wraps every named function in `__name(...)` — a helper
     * that exists in Node and not in the page. Declaring `function parse()`
     * here throws `__name is not defined` in the browser and the whole check
     * silently reports nothing. The contrast maths is done in Node instead;
     * this only collects strings.
     */
    const headings: { sel: string; text: string; color: string; chain: string[] }[] = [];
    for (const el of Array.from(document.querySelectorAll("h1, h2, h3"))) {
      const he = el as HTMLElement;
      const txt = (he.innerText ?? "").trim();
      if (!txt) continue;
      const r = he.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const chain: string[] = [];
      let node: Element | null = he;
      while (node) {
        const cs = getComputedStyle(node);
        chain.push(cs.backgroundColor);
        // A gradient contributes no backgroundColor, so take its first stop —
        // that is what sits behind the top of a hero heading.
        const gm = cs.backgroundImage.match(/rgba?\([^)]+\)/);
        if (gm) chain.push(gm[0]);
        node = node.parentElement;
      }

      const cls =
        typeof he.className === "string" && he.className.trim()
          ? `.${he.className.trim().split(/\s+/)[0]}`
          : "";
      headings.push({
        sel: `${he.tagName.toLowerCase()}${cls}`,
        text: txt.slice(0, 40),
        color: getComputedStyle(he).color,
        chain,
      });
    }

    return {
      brokenImages,
      overflowBy,
      widest,
      h1Count: h1s.length,
      h1: h1s[0] ?? "",
      linkCount: new Set(navLinks).size,
      inNav,
      textLength: bodyText.length,
      headings,
      hasNextError: /Application error|Unhandled Runtime Error|This page could not be found/i.test(bodyText),
    };
  });

  for (const h of dom.headings) {
    const parsedFg = rgba(h.color);
    if (!parsedFg) continue;
    const bg = effectiveBackground(h.chain);
    // Translucent text sits on its own background too.
    const fg: [number, number, number] = [
      Math.round(parsedFg[0] * parsedFg[3] + bg[0] * (1 - parsedFg[3])),
      Math.round(parsedFg[1] * parsedFg[3] + bg[1] * (1 - parsedFg[3])),
      Math.round(parsedFg[2] * parsedFg[3] + bg[2] * (1 - parsedFg[3])),
    ];
    const cr = contrast(fg, bg);
    // 3:1 is the WCAG minimum for large text, and headings are large. Anything
    // under it is not a design opinion — it is unreadable.
    if (cr < 3) {
      findings.push({
        level: "error",
        kind: "contrast",
        detail: `${h.sel} "${h.text}" — ${cr.toFixed(2)}:1 (${h.color} on ${bg.join(",")})`,
      });
    }
  }

  if (dom.hasNextError) {
    findings.push({ level: "error", kind: "runtime", detail: "Next.js error screen rendered" });
  }
  if (dom.brokenImages.length) {
    findings.push({
      level: "error",
      kind: "broken-image",
      detail: dom.brokenImages.join(", "),
    });
  }
  if (viewport === "mobile" && dom.overflowBy > 2) {
    findings.push({
      level: "error",
      kind: "h-overflow",
      detail: `scrolls ${dom.overflowBy}px sideways${dom.widest ? ` — widest: ${dom.widest}` : ""}`,
    });
  }
  if (dom.h1Count === 0) {
    findings.push({ level: "warn", kind: "no-h1", detail: "page has no <h1>" });
  }
  if (dom.h1Count > 1) {
    findings.push({ level: "warn", kind: "multi-h1", detail: `${dom.h1Count} <h1> elements` });
  }
  if (dom.inNav === 0) {
    findings.push({
      level: "warn",
      kind: "no-nav",
      detail: "no links inside <nav> or <header> — no persistent way off this page",
    });
  }
  if (dom.textLength < 120) {
    findings.push({
      level: "warn",
      kind: "thin",
      detail: `only ${dom.textLength} chars of visible text`,
    });
  }

  return findings;
}

async function visit(
  ctx: BrowserContext,
  persona: Persona,
  route: string,
  base: string,
  viewport: (typeof VIEWPORTS)[number]
): Promise<Result> {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  const findings: Finding[] = [];
  const url = `${base}${route}`;

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // React's hydration notes and the dev overlay's own chatter are noise.
      if (/Download the React DevTools|Fast Refresh/i.test(t)) return;
      findings.push({ level: "error", kind: "console", detail: t.slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => {
    findings.push({ level: "error", kind: "exception", detail: String(err).slice(0, 300) });
  });
  page.on("requestfailed", (req) => {
    const f = req.failure()?.errorText ?? "failed";
    if (/ERR_ABORTED/.test(f)) return; // navigation cancels, not defects
    findings.push({
      level: "warn",
      kind: "request-failed",
      detail: `${req.method()} ${req.url().slice(0, 140)} — ${f}`,
    });
  });

  let status: number | null = null;
  let title = "";
  let shot: string | null = null;

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    status = res?.status() ?? null;
    // Let client components paint before judging the layout.
    await page.waitForTimeout(1200);
    title = await page.title();

    if (status && status >= 400) {
      findings.push({ level: "error", kind: "http", detail: `HTTP ${status}` });
    }

    findings.push(...(await inspect(page, viewport.name)));

    const safe = route === "/" ? "root" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    shot = path.join("shots", `${persona}--${safe}--${viewport.name}.png`);
    await page.screenshot({ path: path.join(OUT, shot), fullPage: true });
  } catch (err) {
    findings.push({
      level: "error",
      kind: "navigation",
      detail: String(err).split("\n")[0].slice(0, 240),
    });
  }

  await page.close();
  return { persona, route, url, viewport: viewport.name, status, title, shot, findings };
}

/** Find a real dynamic URL by reading the index page, rather than guessing a slug. */
async function discover(ctx: BrowserContext, indexPath: string, pattern: RegExp, base = BASE): Promise<string | null> {
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}${indexPath}`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(800);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    const hit = hrefs.find((h) => pattern.test(h));
    return hit ?? null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/courses",
  "/programs",
  "/blog",
  "/events",
  "/showcase",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
  "/login/parent",
  "/register",
  "/staff",
  "/student",
];

const PORTAL_ROUTES = [
  "/portal",
  "/portal/courses",
  "/portal/programs",
  "/portal/records",
  "/portal/invoices",
  "/portal/account",
];

const CHILD_ROUTES = ["/me"];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/courses",
  "/admin/programs",
  "/admin/blog",
  "/admin/blog/new",
  "/admin/events",
  "/admin/faqs",
  "/admin/invoices",
  "/admin/members",
  "/admin/messages",
  "/admin/records",
  "/admin/showcase",
  "/admin/subscribers",
  "/admin/testimonials",
  "/admin/competitions",
];

function writeReport() {
  const errors = results.flatMap((r) =>
    r.findings.filter((f) => f.level === "error").map((f) => ({ r, f }))
  );
  const warns = results.flatMap((r) =>
    r.findings.filter((f) => f.level === "warn").map((f) => ({ r, f }))
  );

  const byKind = new Map<string, number>();
  for (const { f } of [...errors, ...warns]) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);

  const lines: string[] = [];
  lines.push("# UI sweep");
  lines.push("");
  lines.push(`_${new Date().toISOString()} — ${results.length} page loads_`);
  lines.push("");
  lines.push(`**${errors.length} errors · ${warns.length} warnings**`);
  lines.push("");
  lines.push("| Kind | Count |");
  lines.push("|---|---|");
  for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${n} |`);
  }
  lines.push("");

  for (const level of ["error", "warn"] as const) {
    const set = level === "error" ? errors : warns;
    if (!set.length) continue;
    lines.push(`## ${level === "error" ? "Errors" : "Warnings"}`);
    lines.push("");
    lines.push("| Persona | Route | Viewport | Kind | Detail |");
    lines.push("|---|---|---|---|---|");
    for (const { r, f } of set) {
      lines.push(
        `| ${r.persona} | \`${r.route}\` | ${r.viewport} | ${f.kind} | ${f.detail.replace(/\|/g, "\\|")} |`
      );
    }
    lines.push("");
  }

  lines.push("## Every page visited");
  lines.push("");
  lines.push("| Persona | Route | Viewport | HTTP | Title | Findings | Shot |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    lines.push(
      `| ${r.persona} | \`${r.route}\` | ${r.viewport} | ${r.status ?? "—"} | ${(r.title || "—").replace(/\|/g, "\\|").slice(0, 50)} | ${r.findings.length} | ${r.shot ? `[png](${r.shot.replace(/\\/g, "/")})` : "—"} |`
    );
  }

  fs.writeFileSync(path.join(OUT, "report.md"), lines.join("\n"), "utf8");
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2), "utf8");
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? (onlyArg.split("=")[1] as Persona) : null;
  const wants = (p: Persona) => !only || only === p;

  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch();
  console.log(`Sweeping ${BASE}${ADMIN_HOST ? ` (admin on ${ADMIN_BASE})` : ""}\n`);

  async function sweep(ctx: BrowserContext, persona: Persona, routes: string[], base: string) {
    for (const route of routes) {
      for (const vp of VIEWPORTS) {
        const r = await visit(ctx, persona, route, base, vp);
        results.push(r);
        const errs = r.findings.filter((f) => f.level === "error").length;
        const warn = r.findings.filter((f) => f.level === "warn").length;
        const mark = errs ? "✖" : warn ? "!" : "✔";
        console.log(
          `  ${mark} ${persona.padEnd(6)} ${vp.name.padEnd(7)} ${route.padEnd(24)} ${r.status ?? "—"}` +
            (errs || warn ? `  (${errs} err, ${warn} warn)` : "")
        );
        writeReport(); // incremental — a run that dies still leaves findings
      }
    }
  }

  try {
    if (wants("public")) {
      const ctx = await browser.newContext();
      const routes = [...PUBLIC_ROUTES];
      for (const [index, re] of [
        ["/courses", /^\/courses\/[^/]+$/],
        ["/programs", /^\/programs\/[^/]+$/],
        ["/blog", /^\/blog\/[^/]+$/],
        ["/events", /^\/events\/[^/]+$/],
      ] as const) {
        const found = await discover(ctx, index, re);
        if (found) routes.push(found);
        else console.log(`  (no detail link found on ${index} — nothing published?)`);
      }
      console.log("PUBLIC");
      await sweep(ctx, "public", routes, BASE);
      await ctx.close();
    }

    if (wants("parent")) {
      console.log("\nPARENT");
      const ctx = await parentContext(browser);
      await assertLandedOn(ctx, `${BASE}/portal`, /\/login/);
      await sweep(ctx, "parent", PORTAL_ROUTES, BASE);
      await ctx.close();
    }

    if (wants("child")) {
      console.log("\nCHILD");
      const ctx = await childContext(browser);
      const routes = [...CHILD_ROUTES];
      const course = await discover(ctx, "/me", /^\/learn\/[^/]+$/);
      if (course) {
        routes.push(course);
        const lesson = await discover(ctx, course, /^\/learn\/[^/]+\/[^/]+$/);
        if (lesson) routes.push(lesson);
        else console.log("  (no lesson link on the course page)");
      } else {
        console.log("  (no course link on /me — child has no enrolments?)");
      }
      await sweep(ctx, "child", routes, BASE);
      await ctx.close();
    }

    if (wants("admin")) {
      console.log("\nADMIN");
      // Signed in ON THE ADMIN ORIGIN — see parentContext.
      const ctx = await parentContext(browser, ADMIN_BASE);
      await assertLandedOn(ctx, `${ADMIN_BASE}/admin`, /\/staff|\/login/);
      const routes = [...ADMIN_ROUTES];
      const course = await discover(ctx, "/admin/courses", /^\/admin\/courses\/[^/]+$/, ADMIN_BASE);
      if (course) routes.push(course);
      await sweep(ctx, "admin", routes, ADMIN_BASE);
      await ctx.close();
    }
  } finally {
    await browser.close();
    writeReport();
  }

  const errors = results.reduce((n, r) => n + r.findings.filter((f) => f.level === "error").length, 0);
  const warns = results.reduce((n, r) => n + r.findings.filter((f) => f.level === "warn").length, 0);
  console.log(`\n${results.length} page loads — ${errors} errors, ${warns} warnings`);
  console.log(`Report: .ui-sweep/report.md`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  writeReport();
  process.exit(1);
});
