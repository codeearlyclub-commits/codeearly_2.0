/**
 * Which host is allowed to serve which path.
 *
 * Extracted from the proxy as a pure function so it can be tested directly. The
 * proxy itself runs on the Edge inside Next's request pipeline, which is
 * expensive to stand up and awkward to assert against; the RULE is the part that
 * can quietly go wrong, and this is it.
 *
 * When `adminHost` is null the split is off and everything is allowed — a
 * single-host deployment is a legitimate configuration, and it is what local
 * development uses.
 */

export type HostDecision =
  | { kind: "allow" }
  /** Serve the site's 404 — this host must not admit the path exists. */
  | { kind: "not-found" }
  /** The admin host's front door. */
  | { kind: "redirect"; to: string };

/**
 * Prefixes the admin host may serve.
 *
 * The API list is narrow on purpose. Allowing all of `/api` would let the admin
 * hostname serve the child sign-in and the parent checkout — endpoints with no
 * business on a hostname that is about to sit behind an office IP allowlist.
 */
export const ADMIN_ALLOWED = [
  "/admin",
  "/staff",
  "/api/auth",
  "/api/admin",
  "/api/health",
  "/_next",
] as const;

/** Prefixes that belong ONLY to the admin host once the split is on. */
export const ADMIN_ONLY = ["/admin"] as const;

function matches(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * A file at the web root, like `/icon.svg` or `/logo-mark.svg`.
 *
 * Listing these as prefixes did not work and the test caught it: `/icon` matches
 * `/icon` and `/icon/…` but never `/icon.svg`, so the admin host 404'd its own
 * favicon and logo.
 *
 * The proxy's matcher already skips most static extensions before this function
 * ever runs, so in practice those requests never arrived here — which is exactly
 * why it would have gone unnoticed until someone widened the matcher. Everything
 * matched here lives in `public/` and is served to anyone anyway.
 */
function isRootAsset(path: string): boolean {
  return /^\/[^/]+\.[a-z0-9]+$/i.test(path);
}

/** Strip the port — `Host` carries both, and only the name is compared. */
export function hostnameOf(host: string | null | undefined): string {
  return (host ?? "").split(":")[0]!.toLowerCase();
}

export function decideHostRouting(input: {
  /** The request's Host header, port included or not. */
  host: string | null | undefined;
  path: string;
  /** ADMIN_HOST, or null when the split is off. */
  adminHost: string | null;
}): HostDecision {
  const { path, adminHost } = input;

  if (!adminHost) return { kind: "allow" };

  const onAdminHost = hostnameOf(input.host) === adminHost.trim().toLowerCase();

  if (onAdminHost) {
    // The admin host's front door is the admin, not the marketing site.
    if (path === "/") return { kind: "redirect", to: "/admin" };
    return matches(path, ADMIN_ALLOWED) || isRootAsset(path)
      ? { kind: "allow" }
      : { kind: "not-found" };
  }

  // The public site does not admit the admin exists.
  return matches(path, ADMIN_ONLY) ? { kind: "not-found" } : { kind: "allow" };
}
