/**
 * Session isolation — three audiences, three surfaces, no bleed.
 *
 * WHAT THIS EXISTS TO CATCH
 *
 * The parent session (a Better Auth cookie) and the child session (our own
 * `ce_child_session` cookie) are separate systems. For a while they knew nothing
 * about each other, so BOTH could be set at once and every surface was reachable
 * simultaneously — a child who signed in on the family laptop was one typed URL
 * from billing, and from /admin if their parent was staff. That was found by
 * running this scenario, not by reading the code, which is why it is asserted
 * here forever.
 *
 * This runs over HTTP against a live server rather than against the services,
 * because the thing under test IS the cookie and redirect behaviour. A
 * service-level test cannot see a Set-Cookie header.
 *
 *   npx tsx scripts/check-session-isolation.ts
 *
 * Destructive: creates and removes its own parent, child and sign-in code.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createChild } from "@/server/members/children";
import { issueStudentLogin } from "@/server/members/child-login";

/**
 * Must match BETTER_AUTH_URL's host exactly.
 *
 * Better Auth checks the Origin of a state-changing request against its trusted
 * origins, and `127.0.0.1` is NOT the same origin as `localhost` — every
 * sign-in came back 403 until this agreed with the configured URL.
 */
const BASE =
  process.env.CHECK_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const PARENT_EMAIL = "isolation-check@example.com";
const PASSWORD = "IsolationCheck2026!";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/**
 * A minimal cookie jar.
 *
 * Deliberately hand-rolled rather than letting fetch follow redirects and manage
 * state: the assertions here are ABOUT which cookies exist and which redirects
 * happen, so both have to be visible.
 */
class Jar {
  private jar = new Map<string, string>();

  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair!.indexOf("=");
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const expired =
        /Max-Age=0/i.test(raw) || attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a));
      if (!value || expired) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name: string): boolean {
    return this.jar.has(name);
  }

  names(): string[] {
    return [...this.jar.keys()];
  }
}

async function get(path: string, jar: Jar) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: jar.header(), accept: "text/html" },
    redirect: "manual",
  });
  jar.absorb(res);
  return { status: res.status, location: res.headers.get("location") };
}

async function post(path: string, jar: Jar, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      cookie: jar.header(),
      // Better Auth rejects a state-changing request with no Origin — its CSRF
      // defence, and a real browser always sends one. Omitting it here made
      // every sign-in 403, which looked like an auth bug and was a test bug.
      origin: BASE,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  jar.absorb(res);
  return res;
}

/** Does this redirect land on `expected`? Handles absolute and relative. */
function redirectsTo(location: string | null, expected: string): boolean {
  if (!location) return false;
  const path = location.startsWith("http") ? new URL(location).pathname : location;
  return path === expected || path.startsWith(`${expected}?`);
}

async function cleanup() {
  const parent = await prisma.user.findFirst({ where: { email: PARENT_EMAIL } });
  if (parent) {
    await prisma.child.deleteMany({ where: { parentId: parent.id } });
    await prisma.session.deleteMany({ where: { userId: parent.id } });
    await prisma.account.deleteMany({ where: { userId: parent.id } });
    await prisma.user.delete({ where: { id: parent.id } });
  }
}

async function main() {
  // Fail loudly rather than reporting green against nothing.
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`✖ no server at ${BASE} — start it first (npm run dev).`);
    process.exit(1);
  }

  await cleanup();

  // ── Fixtures ───────────────────────────────────────────────────────────────
  await auth.api.signUpEmail({
    body: { email: PARENT_EMAIL, password: PASSWORD, name: "Isolation Check" },
  });
  const parent = await prisma.user.findFirstOrThrow({ where: { email: PARENT_EMAIL } });
  // Verified, or the portal shows the "confirm your email" page instead.
  await prisma.user.update({ where: { id: parent.id }, data: { emailVerified: true } });

  const child = await createChild({ parentId: parent.id, childName: "Isolation Kid" });
  const login = await issueStudentLogin(parent.id, child.id);

  console.log("\nParent signs in");
  const jar = new Jar();
  const signIn = await post("/api/auth/sign-in/email", jar, {
    email: PARENT_EMAIL,
    password: PASSWORD,
  });
  check("sign-in succeeds", signIn.ok, `${signIn.status}`);
  check("a parent session cookie is set", jar.names().some((n) => n.includes("session")));
  check("no child cookie", !jar.has("ce_child_session"));

  const portal = await get("/portal", jar);
  check("the parent reaches the portal", portal.status === 200, `${portal.status}`);

  console.log("\nThe child signs in on the SAME browser");
  const childLogin = await post("/api/student/login", jar, {
    loginCode: login.loginCode,
    pin: login.pin,
  });
  check("child sign-in succeeds", childLogin.ok, `${childLogin.status}`);
  check("a child cookie is now set", jar.has("ce_child_session"));

  // The heart of it. Both cookies must not survive together.
  check(
    "THE PARENT SESSION IS GONE",
    !jar.names().some((n) => n.includes("session_token")),
    `cookies: ${jar.names().join(", ") || "none"}`
  );

  const me = await get("/me", jar);
  check("the child reaches their own lessons", me.status === 200, `${me.status}`);

  const portalAsChild = await get("/portal", jar);
  check(
    "the child CANNOT reach the portal",
    portalAsChild.status === 307 || portalAsChild.status === 302,
    `${portalAsChild.status} → ${portalAsChild.location ?? "—"}`
  );
  check(
    "and is sent to their own home, not a parent sign-in form",
    redirectsTo(portalAsChild.location, "/me"),
    portalAsChild.location ?? "—"
  );

  const adminAsChild = await get("/admin", jar);
  check(
    "the child CANNOT reach the admin",
    adminAsChild.status === 307 || adminAsChild.status === 302,
    `${adminAsChild.status} → ${adminAsChild.location ?? "—"}`
  );

  // The parent's token was revoked server-side, not merely un-cookied. Replaying
  // it must fail even though the string is still valid-looking.
  const stolen = new Jar();
  stolen.absorb(signIn as unknown as Response);
  const replay = await get("/portal", stolen);
  check(
    "the revoked parent token cannot be replayed",
    replay.status !== 200,
    `${replay.status} → ${replay.location ?? "—"}`
  );

  console.log("\nThe parent signs back in");
  const jar2 = new Jar();
  await post("/api/student/login", jar2, { loginCode: login.loginCode, pin: login.pin });
  check("child signed in first", jar2.has("ce_child_session"));

  // The sign-in form calls this before signing in; asserted directly so the
  // eviction is covered even if the form changes.
  await post("/api/student/logout", jar2);
  const signIn2 = await post("/api/auth/sign-in/email", jar2, {
    email: PARENT_EMAIL,
    password: PASSWORD,
  });
  check("parent sign-in succeeds", signIn2.ok, `${signIn2.status}`);
  check("THE CHILD SESSION IS GONE", !jar2.has("ce_child_session"), `cookies: ${jar2.names().join(", ")}`);

  const meAsParent = await get("/me", jar2);
  check(
    "the parent CANNOT reach the child's lessons",
    meAsParent.status === 307 || meAsParent.status === 302,
    `${meAsParent.status} → ${meAsParent.location ?? "—"}`
  );
  check(
    "and is sent to the student door",
    redirectsTo(meAsParent.location, "/student"),
    meAsParent.location ?? "—"
  );

  console.log("\nA non-admin parent and the staff tool");
  const adminAsParent = await get("/admin", jar2);
  check(
    "a parent CANNOT reach the admin",
    adminAsParent.status === 307 || adminAsParent.status === 302,
    `${adminAsParent.status} → ${adminAsParent.location ?? "—"}`
  );
  check(
    "and is bounced to the portal, which does not admit /admin exists",
    redirectsTo(adminAsParent.location, "/portal"),
    adminAsParent.location ?? "—"
  );

  console.log("\nThe doors themselves");
  for (const [path, expect] of [
    ["/login", 200],
    ["/login/parent", 200],
    ["/student", 200],
    ["/staff", 200],
  ] as const) {
    const res = await get(path, new Jar());
    check(`${path} is reachable signed out`, res.status === expect, `${res.status}`);
  }

  const adminAnon = await get("/admin", new Jar());
  check(
    "a stranger at /admin is sent to the staff door",
    redirectsTo(adminAnon.location, "/staff"),
    `${adminAnon.status} → ${adminAnon.location ?? "—"}`
  );

  await cleanup();

  console.log(
    failures === 0
      ? "\n✅ the three audiences stay separated"
      : `\n❌ ${failures} isolation check(s) failed`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  process.exit(1);
});
