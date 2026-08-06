/**
 * Which host serves which path.
 *
 * Both halves of the split are easy to half-implement. Blocking /admin on the
 * main site while leaving the admin host serving everything would look correct
 * in a browser, and would leave the portal, the child area and every marketing
 * page reachable on the hostname an IP allowlist is about to be pointed at —
 * exactly the gap an allowlist gives people false confidence about.
 */
import { describe, it, expect } from "vitest";

import { decideHostRouting } from "@/lib/host-routing";

const ADMIN = "admin.codeearly.com";
const WWW = "www.codeearly.com";

function decide(host: string, path: string, adminHost: string | null = ADMIN) {
  return decideHostRouting({ host, path, adminHost });
}

describe("split off", () => {
  it("allows everything when ADMIN_HOST is unset", () => {
    for (const path of ["/", "/admin", "/portal", "/me"]) {
      expect(decide("localhost:3000", path, null)).toEqual({ kind: "allow" });
    }
  });
});

describe("the main site hides the admin", () => {
  it("404s /admin", () => {
    expect(decide(WWW, "/admin").kind).toBe("not-found");
  });

  it("404s everything beneath it", () => {
    expect(decide(WWW, "/admin/courses").kind).toBe("not-found");
    expect(decide(WWW, "/admin/blog/abc123").kind).toBe("not-found");
  });

  it("still serves the rest of the site", () => {
    for (const path of ["/", "/courses", "/portal", "/me", "/login", "/student", "/staff"]) {
      expect(decide(WWW, path)).toEqual({ kind: "allow" });
    }
  });

  it("does not block a path that merely starts with the same letters", () => {
    // `/administrators` is not under `/admin`.
    expect(decide(WWW, "/administrators")).toEqual({ kind: "allow" });
  });

  it("still serves the APIs the site needs", () => {
    for (const path of ["/api/auth/sign-in/email", "/api/student/login", "/api/portal/checkout"]) {
      expect(decide(WWW, path)).toEqual({ kind: "allow" });
    }
  });
});

describe("the admin host serves only the admin", () => {
  it("sends its front door to /admin", () => {
    expect(decide(ADMIN, "/")).toEqual({ kind: "redirect", to: "/admin" });
  });

  it("serves the admin and the staff door", () => {
    for (const path of ["/admin", "/admin/courses", "/staff"]) {
      expect(decide(ADMIN, path)).toEqual({ kind: "allow" });
    }
  });

  it("404s the public site, the portal and the child area", () => {
    for (const path of ["/courses", "/blog", "/portal", "/me", "/learn/scratch", "/login", "/student"]) {
      expect(decide(ADMIN, path).kind).toBe("not-found");
    }
  });

  it("serves only the APIs the admin actually calls", () => {
    for (const path of ["/api/auth/sign-in/email", "/api/admin/search", "/api/health"]) {
      expect(decide(ADMIN, path)).toEqual({ kind: "allow" });
    }
  });

  it("404s the family APIs — nothing here should reach a child sign-in", () => {
    for (const path of ["/api/student/login", "/api/portal/checkout", "/api/contact", "/api/newsletter"]) {
      expect(decide(ADMIN, path).kind).toBe("not-found");
    }
  });

  it("serves its own assets", () => {
    for (const path of ["/_next/static/chunk.js", "/logo-mark.svg", "/icon.svg"]) {
      expect(decide(ADMIN, path)).toEqual({ kind: "allow" });
    }
  });
});

describe("host matching", () => {
  it("ignores the port", () => {
    expect(decide(`${ADMIN}:3000`, "/admin")).toEqual({ kind: "allow" });
  });

  it("is case-insensitive", () => {
    expect(decide(ADMIN.toUpperCase(), "/admin")).toEqual({ kind: "allow" });
    expect(decideHostRouting({ host: ADMIN, path: "/admin", adminHost: ADMIN.toUpperCase() })).toEqual({
      kind: "allow",
    });
  });

  it("treats a missing Host header as the public site", () => {
    // Fail closed: no Host must never be mistaken for the admin host.
    expect(decideHostRouting({ host: null, path: "/admin", adminHost: ADMIN }).kind).toBe(
      "not-found"
    );
  });

  it("does not match a lookalike host", () => {
    // An attacker-controlled Host header must not unlock the admin.
    expect(decide("admin.codeearly.com.evil.test", "/admin").kind).toBe("not-found");
    expect(decide("notadmin.codeearly.com", "/admin").kind).toBe("not-found");
  });
});
