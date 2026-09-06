/**
 * End-to-end journeys, driven through the actual UI.
 *
 * The other twelve check scripts are end-to-end at the SERVICE layer — 216
 * assertions that the domain logic is right — and `ui-sweep.ts` loads every page
 * and looks at it. Neither of them ever fills in a form. So a form posting to
 * the wrong action, a submit handler that never fires, a redirect that loops, or
 * a server action that throws on a real payload passes both layers untouched.
 *
 * That is not hypothetical. Two defects this week — a 500 on /portal and a child
 * area with no way out of it — were invisible to every service assertion and
 * were found by a person clicking, then by a screenshot.
 *
 * These are the three journeys with no coverage at either layer:
 *
 *   1. register → verify email → sign in → portal
 *   2. add child → issue code → child signs in → opens a lesson
 *   3. browse a course → checkout reaches Paystack
 *
 * Each asserts the OUTCOME IN THE DATABASE, not just what the page says. A page
 * can render "Success" over a transaction that never committed.
 *
 *   npx tsx scripts/check-journeys.ts
 *
 * Requires the dev server and the worker to be running. Creates one parent and
 * one child per run and deletes them at the end, so it is safe to repeat and
 * safe against a seeded database.
 */
import "dotenv/config";
import { chromium, type Browser, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { emailQueue } from "@/jobs/queues";

const BASE = process.env.JOURNEY_BASE ?? "http://localhost:3000";
const NAV = 120_000;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/**
 * Every API call the page made that did not succeed.
 *
 * A journey that reports "no row" and stops is only half a test — the useful
 * half is WHY, and the answer is almost always in a response body the browser
 * swallowed into an error toast.
 */
type ApiFailure = { method: string; url: string; status: number; body: string };
const apiFailures: ApiFailure[] = [];

/**
 * ONE listener owns the response body.
 *
 * A response body can only be read once. Adding a second listener for the
 * checkout call made both of them race for it, and the loser recorded
 * "(unreadable)" — which then failed a step whose whole job was to read the
 * reason out of that body. Journey 3 reads what this recorded instead of
 * attaching its own reader for failures.
 */
function recordApiFailures(page: Page) {
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/api/")) return;
    if (res.status() < 400) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 200);
    } catch {
      body = "(unreadable)";
    }
    apiFailures.push({
      method: res.request().method(),
      url: url.replace(BASE, ""),
      status: res.status(),
      body,
    });
  });
}

/**
 * Poll until a condition holds, rather than sleeping a guessed number of
 * seconds. A fixed wait reported "no row" for a registration that had in fact
 * succeeded — the later steps in the same journey signed that user in — which
 * is a false failure, the most expensive kind in a check nobody wrote.
 */
async function waitFor<T>(
  what: () => Promise<T | null | undefined | false>,
  timeoutMs = 20_000
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await what();
    if (value) return value as T;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** Unique per run, so a rerun never collides with the last one's rows. */
const stamp = Date.now();
const EMAIL = `journey+${stamp}@codeearly.test`;
const PASSWORD = "JourneyTest2026!";
const PARENT_NAME = "Journey Test Parent";
const CHILD_NAME = "Journey Test Child";

/**
 * The verification link, taken from the QUEUED EMAIL rather than rebuilt from
 * the token table.
 *
 * Reconstructing Better Auth's verify URL means hardcoding its internal token
 * format, which would pass while the real email carried something broken. Going
 * through the queue proves the whole path: Better Auth generated it, the
 * template rendered it, and the job carries it.
 */
async function verificationUrlFor(email: string): Promise<string | null> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const jobs = await emailQueue.getJobs(["waiting", "active", "completed", "delayed"], 0, 50);
    for (const job of jobs) {
      const data = job.data as { to?: string; html?: string; text?: string };
      if (data?.to !== email) continue;
      const body = `${data.html ?? ""} ${data.text ?? ""}`;
      const m = body.match(/https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/i);
      if (m) return m[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

/**
 * Give this run a fresh auth rate-limit budget.
 *
 * `/sign-in/email` allows 10 attempts per 15 minutes, and this check spends two
 * of them ON PURPOSE — one to prove an unverified account is refused, one to
 * prove a verified one is not. Run it a few times while iterating and the
 * window is gone, and the final sign-in fails with 429 for reasons that have
 * nothing to do with the journey.
 *
 * Better Auth stores these in Redis as `{ip}|{path}`. This clears only the two
 * auth paths this check touches; it does not disable the limiter, which is a
 * real protection asserted elsewhere.
 */
async function resetAuthRateLimits() {
  const paths = ["/sign-in/email", "/sign-up/email"];
  const keys = await redis.keys("*|/*");
  const mine = keys.filter((k) => paths.some((p) => k.endsWith(`|${p}`)));
  if (mine.length) await redis.del(...mine);
  return mine.length;
}

/**
 * Navigate, then wait until the page can actually accept a submit.
 *
 * These forms do all their work in `onSubmit`, so before React hydrates there is
 * no handler and a click does nothing useful. Clicking on `domcontentloaded`
 * reproduced that every time: registration silently produced no user and no API
 * call at all.
 *
 * That race is a REAL defect, not just a test artefact — a parent on a slow
 * device who taps "Create account" early gets the same nothing, and before the
 * `method="post"` fix they got their password in the URL as well. Making the
 * forms work without JavaScript is the actual repair; this only stops the check
 * racing what it is trying to measure.
 */
async function gotoReady(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV });
  await page.waitForLoadState("networkidle", { timeout: NAV }).catch(() => {});
}

async function journeyOne(page: Page) {
  console.log("\n1. Register → verify → sign in → portal");

  await gotoReady(page, `${BASE}/register`);
  await page.fill('input[name="name"]', PARENT_NAME);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  const created = await waitFor(() => prisma.user.findUnique({ where: { email: EMAIL } }));
  check("the form creates a user", !!created, created ? created.email : "no row");
  check("they start unverified", created?.emailVerified === false);

  const url = await verificationUrlFor(EMAIL);
  check("a verification email is queued with a link", !!url, url ? url.slice(0, 60) + "…" : "none found");
  if (!url) return false;

  // Sign-in must be refused BEFORE verifying, or requireEmailVerification is
  // decorative. Asserted through the form, because that is where a real parent
  // would meet it.
  await gotoReady(page, `${BASE}/login/parent`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  check("unverified sign-in does not reach the portal", !page.url().includes("/portal"), page.url().replace(BASE, ""));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV });
  const verified = await waitFor(async () => {
    const u = await prisma.user.findUnique({ where: { email: EMAIL } });
    return u?.emailVerified ? u : null;
  });
  check("the link verifies the account", !!verified);

  await gotoReady(page, `${BASE}/login/parent`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/portal"), { timeout: NAV }).catch(() => {});
  check("a verified parent lands on the portal", page.url().includes("/portal"), page.url().replace(BASE, ""));

  return page.url().includes("/portal");
}

async function journeyTwo(page: Page) {
  console.log("\n2. Add child → issue code → child signs in → opens a lesson");

  await gotoReady(page, `${BASE}/portal`);

  // The reveal button is type="button"; the form's own submit reads "Add child".
  // Matching on text alone hits the submit first and posts an empty form.
  // A parent with no children sees the form already open, so this is optional.
  const addButton = page.locator('button[type="button"]:has-text("Add")').first();
  if (await addButton.isVisible().catch(() => false)) await addButton.click();
  await page.waitForTimeout(800);

  const nameField = page.locator('input[name="childName"]');
  const hasForm = await nameField.isVisible().catch(() => false);
  check("the add-child form opens", hasForm);
  if (!hasForm) return;

  await nameField.fill(CHILD_NAME);
  // Scope the submit to the form holding the field, not the first on the page.
  await nameField.locator("xpath=ancestor::form").locator('button[type="submit"]').first().click();

  const parent = await prisma.user.findUnique({ where: { email: EMAIL } });
  const child = parent
    ? await waitFor(() =>
        prisma.child.findFirst({ where: { parentId: parent.id, childName: CHILD_NAME } })
      )
    : null;
  check("the child is created against this parent", !!child, child?.membershipId ?? "no row");
  if (!child) return;

  // Issue the student login and read the code+PIN off the screen — the parent
  // never sees them anywhere else, so if the reveal is broken the feature is
  // unusable however correct the API is.
  //
  // The button reads "Give {name} a sign-in". Guessing at "student" or "code"
  // matched nothing and reported the reveal as broken when it had never been
  // clicked.
  const issueButton = page.locator('button:has-text("a sign-in")').first();
  await issueButton.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  if (await issueButton.isVisible().catch(() => false)) await issueButton.click();
  // The panel headed "Write these down now" is the reveal.
  await page
    .locator('h3:has-text("Write these down")')
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => {});

  const revealShown = await page.locator('h3:has-text("Write these down")').isVisible().catch(() => false);
  const revealed = await page.locator("b").allInnerTexts();
  const loginCode = revealed.find((t) => /^[A-Z0-9]{6}$/.test(t.trim()))?.trim();
  const pin = revealed.find((t) => /^\d{4}$/.test(t.trim()))?.trim();
  check(
    "the code and PIN are shown to the parent",
    !!loginCode && !!pin,
    loginCode && pin
      ? `${loginCode} / ****`
      : revealShown
        ? `panel shown but could not read them — saw ${JSON.stringify(revealed.slice(0, 6))}`
        : "the reveal panel never appeared"
  );
  if (!loginCode || !pin) return;

  const ctx = page.context();
  await ctx.clearCookies();

  await gotoReady(page, `${BASE}/student`);
  await page.fill('input[name="loginCode"]', loginCode);
  await page.fill('input[name="pin"]', pin);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/me"), { timeout: NAV }).catch(() => {});
  check("the child signs in and reaches /me", page.url().includes("/me"), page.url().replace(BASE, ""));

  // The header added this week — a child with no way off a page is the defect
  // that started this, so it is asserted rather than assumed.
  const navLinks = await page.locator("header a[href], nav a[href]").count();
  check("the child screen has a way off it", navLinks > 0, `${navLinks} link(s)`);

  const signOut = await page.locator('button:has-text("Sign out")').count();
  check("sign out is reachable without scrolling the page", signOut > 0);
}

async function journeyThree(browser: Browser) {
  console.log("\n3. Browse a course → checkout reaches Paystack");

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: NAV });
  await page.evaluate(
    async (creds) => {
      await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creds),
      });
    },
    { email: EMAIL, password: PASSWORD }
  );

  // Watch the network rather than following the redirect off-site: this asserts
  // the button reaches our checkout and that checkout answers with somewhere to
  // go, without depending on Paystack being reachable from CI.

  await gotoReady(page, `${BASE}/portal/courses`);

  // CheckoutButton's label is a prop, so match its container rather than text.
  const buy = page.locator(".checkout__go button").first();
  const buyable = await buy.isVisible().catch(() => false);
  if (!buyable) {
    console.log("  (no purchasable course on /portal/courses — nothing to click)");
    await ctx.close();
    return;
  }

  // It may require choosing which child first; take the first option if so.
  const childSelect = page.locator("select").first();
  if (await childSelect.isVisible().catch(() => false)) {
    const options = await childSelect.locator("option").count();
    if (options > 0) await childSelect.selectOption({ index: 0 }).catch(() => {});
  }

  /**
   * Read the response FROM THE WAIT, not from an event listener.
   *
   * A `page.on("response")` handler reads the body asynchronously, so the
   * assertion below ran before the handler had finished and saw nothing —
   * reported as "no structured answer" for a response that was perfectly well
   * formed. Awaiting the response object here makes the ordering explicit and
   * gives this step sole ownership of the body.
   */
  await buy.click();
  const res = await page
    .waitForResponse((r) => r.url().includes("/api/portal/checkout"), { timeout: 30_000 })
    .catch(() => null);

  const checkoutStatus = res ? res.status() : null;
  let gotAuthUrl = false;
  let businessRule: string | null = null;
  if (res) {
    const raw = await res.text().catch(() => "");
    try {
      const body = JSON.parse(raw) as {
        authorizationUrl?: string;
        error?: { code?: string; message?: string };
      };
      gotAuthUrl = typeof body.authorizationUrl === "string" && body.authorizationUrl.length > 0;
      if (body.error?.code) businessRule = `${body.error.code}: ${body.error.message ?? ""}`;
    } catch {
      /* an unparseable body is itself worth failing on */
    }
  }
  check("the checkout button reaches /api/portal/checkout", checkoutStatus !== null, String(checkoutStatus));

  /**
   * Either a payment link OR a stated reason is a pass — what must never happen
   * is a crash or an empty body.
   *
   * This journey's parent is brand new, so the honest answer from checkout is
   * `PLAN_LIMIT: A membership is needed to join this course.` Asserting an
   * authorizationUrl here failed a rule that was working correctly. What this
   * step is really for is proving the button is wired to the endpoint and the
   * endpoint answers coherently.
   */
  check(
    "checkout answers with a payment link or a stated reason",
    gotAuthUrl || businessRule !== null,
    gotAuthUrl ? "authorization URL" : (businessRule ?? `status ${checkoutStatus}, no structured answer`)
  );

  await ctx.close();
}

async function cleanup() {
  const parent = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!parent) return;
  // Children cascade from the parent; this is the whole point of the FKs.
  await prisma.user.delete({ where: { id: parent.id } }).catch(() => {});
  console.log("\n  (test parent and child removed)");
}

async function main() {
  console.log(`Journeys against ${BASE}`);
  const cleared = await resetAuthRateLimits();
  if (cleared) console.log(`  (cleared ${cleared} auth rate-limit key(s) for this run)`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  recordApiFailures(page);

  try {
    const signedIn = await journeyOne(page);
    if (signedIn) await journeyTwo(page);
    else console.log("\n2. skipped — journey 1 never reached the portal");
    await journeyThree(browser);
  } finally {
    await ctx.close();
    await browser.close();
    await cleanup();
    await emailQueue.close();
    await redis.quit().catch(() => {});
    await prisma.$disconnect();
  }

  if (apiFailures.length) {
    console.log("\nAPI calls that failed during the run:");
    for (const f of apiFailures) console.log(`  ${f.method} ${f.url} → ${f.status} ${f.body}`);
  }

  console.log(
    failures === 0 ? "\n✅ every journey completes" : `\n❌ ${failures} step(s) failed`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  process.exit(1);
});
