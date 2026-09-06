import { describe, it, expect } from "vitest";

import { libpqUrl } from "@/jobs/backup";

/**
 * pg_dump REFUSES a URI carrying Prisma's parameters — it does not ignore them:
 *
 *     pg_dump: error: invalid URI query parameter: "schema"
 *
 * The nightly backup would have failed every night in production, and it passed
 * every check that did not run pg_dump against the real DATABASE_URL. These
 * tests exist so that cannot come back silently.
 */
describe("the connection string handed to pg_dump", () => {
  it("drops Prisma's schema parameter", () => {
    expect(libpqUrl("postgresql://u:p@host:5432/db?schema=public")).toBe(
      "postgresql://u:p@host:5432/db"
    );
  });

  it("drops connection_limit, which lib/prisma.ts appends at runtime", () => {
    expect(libpqUrl("postgresql://u:p@host:5432/db?schema=public&connection_limit=20")).toBe(
      "postgresql://u:p@host:5432/db"
    );
  });

  it("keeps genuine libpq parameters", () => {
    const out = libpqUrl("postgresql://u:p@host:5432/db?schema=public&sslmode=require");
    expect(out).toContain("sslmode=require");
    expect(out).not.toContain("schema");
  });

  it("leaves a clean URL alone", () => {
    expect(libpqUrl("postgresql://u:p@host:5432/db")).toBe("postgresql://u:p@host:5432/db");
  });

  it("hands back anything it cannot parse rather than refusing to back up", () => {
    expect(libpqUrl("not a url")).toBe("not a url");
  });

  it("preserves a password containing characters that would break a shell", () => {
    // The URL is passed to spawn as an argument, never through a shell, but the
    // password must still survive the round trip intact.
    const out = libpqUrl("postgresql://u:p%24%27%3B%20rm@host:5432/db?schema=public");
    expect(out).toContain("p%24%27%3B%20rm");
  });
});
