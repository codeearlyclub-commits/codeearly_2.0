/**
 * The admin lives on its own origin.
 *
 * When ADMIN_HOST is set, the staff tool moves to its own hostname and the
 * surfaces stop sharing an origin. This asserts both halves of that:
 *
 *   the main site must NOT serve /admin
 *   the admin host must NOT serve anything else
 *
 * Both are easy to half-implement. Blocking /admin on www while leaving the
 * admin host serving the whole site would look correct in a browser and leave
 * the portal, the child area and every marketing page reachable on a hostname
 * that is about to have an IP allowlist pointed at it — which is precisely the
 * kind of gap an allowlist gives people false confidence about.
 *
 * Runs over HTTP with an explicit Host header, so it needs no DNS and no hosts
 * file: the split is decided by the Host header, which is exactly what Caddy
 * will set in production.
 *
 *   ADMIN_HOST=admin.localhost npx tsx scripts/check-admin-host.ts
 *
 * Skips cleanly when ADMIN_HOST is unset, because then there is no split to
 * test and a single-host deployment is a legitimate configuration.
 */
import "dotenv/config";

const BASE =
  process.env.CHECK_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const ADMIN_HOST = process.env.ADMIN_HOST?.trim();

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Fetch a path, pretending to arrive on `host`. */
async function get(path: string, host?: string) {
  const url = new URL(path, BASE);
  const headers: Record<string, string> = { accept: "text/html" };
  if (host) {
    // Preserve the port — the app compares hostnames, but Better Auth and any
    // redirect building compare origins.
    headers.host = url.port ? `${host}:${url.port}` : host;
  }
  const res = await fetch(url, { headers, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`✖ no server at ${BASE} — start it first.`);
    process.exit(1);
  }

  if (!ADMIN_HOST) {
    console.log(
      "\n○ ADMIN_HOST is not set — the admin shares the main host.\n" +
        "  That is a valid single-host deployment, so there is nothing to check.\n" +
        "  Set ADMIN_HOST (e.g. admin.localhost) to enable and test the split."
    );
    process.exit(0);
  }

  console.log(`\nSplit is ON — admin host is "${ADMIN_HOST}"`);

  console.log("\nThe main site hides the admin");
  const adminOnWww = await get("/admin");
  check("/admin 404s on the main host", adminOnWww.status === 404, `${adminOnWww.status}`);

  const adminSubOnWww = await get("/admin/courses");
  check(
    "so do the pages beneath it",
    adminSubOnWww.status === 404,
    `${adminSubOnWww.status}`
  );

  // The rest of the site is untouched.
  for (const path of ["/", "/login", "/student", "/staff"]) {
    const res = await get(path);
    check(`${path} still works on the main host`, res.status === 200, `${res.status}`);
  }

  console.log("\nThe admin host serves only the admin");
  const root = await get("/", ADMIN_HOST);
  check(
    "its front door redirects to /admin",
    root.status === 307 || root.status === 302 || root.status === 308,
    `${root.status} → ${root.location ?? "—"}`
  );

  // Signed out, so /admin bounces to the staff door rather than rendering —
  // that it redirects at all proves the host is serving the admin route.
  const admin = await get("/admin", ADMIN_HOST);
  check(
    "/admin is served here",
    admin.status !== 404,
    `${admin.status} → ${admin.location ?? "—"}`
  );

  const staff = await get("/staff", ADMIN_HOST);
  check("the staff sign-in is reachable here", staff.status === 200, `${staff.status}`);

  for (const path of ["/", "/portal", "/me", "/blog", "/courses", "/login", "/student"]) {
    if (path === "/") continue; // covered above — it redirects rather than 404s
    const res = await get(path, ADMIN_HOST);
    check(`${path} 404s on the admin host`, res.status === 404, `${res.status}`);
  }

  console.log("\nAuth still works across the split");
  // Better Auth refuses an untrusted Origin. If the admin host is missing from
  // trustedOrigins, staff sign-in returns 403 on the very host it is meant for.
  const url = new URL(BASE);
  const adminOrigin = `${url.protocol}//${ADMIN_HOST}${url.port ? `:${url.port}` : ""}`;
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      host: url.port ? `${ADMIN_HOST}:${url.port}` : ADMIN_HOST,
      origin: adminOrigin,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-here" }),
    redirect: "manual",
  });
  check(
    "the admin origin is trusted by Better Auth",
    res.status !== 403,
    `${res.status} (403 means ADMIN_HOST is missing from trustedOrigins)`
  );

  console.log(
    failures === 0 ? "\n✅ the admin has its own origin" : `\n❌ ${failures} check(s) failed`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
