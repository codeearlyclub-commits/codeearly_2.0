/**
 * Nightly database backup.
 *
 * This is the highest-consequence code in the repository. Everything else can be
 * rebuilt from git; the contents of Postgres cannot. Payment records, invoices,
 * report cards and every child's learning history live there, and until this
 * existed a lost volume lost all of it with no recovery path.
 *
 * DELIBERATELY LOCAL FIRST. R2 credentials have been outstanding across three
 * planning documents, and a dump on the same box is weak — it does not survive
 * the machine dying — but it is infinitely better than nothing and it survives
 * the far more common failures: a bad migration, a mistaken DELETE, a dropped
 * table. Phase C uploads these off-box; the interface below is shaped so that is
 * an addition, not a rewrite.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";

export type BackupResult = {
  file: string;
  bytes: number;
  durationMs: number;
  pruned: string[];
};

const DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), ".backups");
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);

/**
 * `pg_dump` writes to stdout and we gzip it on the way to disk, so a large
 * database never has to fit in memory or land uncompressed first.
 *
 * The connection string is passed as an ARGUMENT, not interpolated into a shell
 * command — it contains the database password, and a shell would put it in the
 * process table for every user on the box to read. `spawn` without `shell: true`
 * also means a password containing shell metacharacters cannot break the command
 * apart.
 */
/**
 * Parameters Prisma understands and libpq does not.
 *
 * DATABASE_URL ends `?schema=public`, and `lib/prisma.ts` appends
 * `connection_limit` on top of it. pg_dump does not merely ignore these — it
 * refuses the whole URI:
 *
 *     pg_dump: error: invalid URI query parameter: "schema"
 *
 * So the nightly backup would have failed EVERY night, in production, having
 * passed every check that did not actually run pg_dump against the real
 * connection string. Stripping is a denylist rather than an allowlist so that
 * genuine libpq parameters — `sslmode`, `connect_timeout`, `application_name` —
 * keep working.
 */
const PRISMA_ONLY_PARAMS = [
  "schema",
  "connection_limit",
  "pool_timeout",
  "pgbouncer",
  "socket_timeout",
  "statement_cache_size",
  "sslidentity",
  "sslpassword",
];

export function libpqUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const p of PRISMA_ONLY_PARAMS) url.searchParams.delete(p);
    // Leave no trailing "?" behind — harmless, but it makes logs confusing.
    if ([...url.searchParams.keys()].length === 0) url.search = "";
    return url.toString();
  } catch {
    // A URL Prisma accepts but WHATWG-URL cannot parse: hand it back untouched
    // rather than refusing to back up over a query string.
    return raw;
  }
}

export async function runBackup(now = new Date()): Promise<BackupResult> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set — cannot back up");
  const url = libpqUrl(raw);

  await fs.mkdir(DIR, { recursive: true });

  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const file = path.join(DIR, `codeearly-${stamp}.sql.gz`);
  const started = Date.now();

  const dump = spawn(
    "pg_dump",
    [
      url,
      "--no-owner", // restoring into a differently-named role must just work
      "--no-privileges",
      "--clean", // the restore drops before it creates, so it is idempotent
      "--if-exists",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let stderr = "";
  dump.stderr.on("data", (c: Buffer) => {
    stderr += c.toString();
  });

  const failed = new Promise<never>((_resolve, reject) => {
    dump.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "pg_dump not found on PATH. The worker image installs postgresql16-client; " +
              "running the worker directly on a host without it cannot take backups."
          )
        );
        return;
      }
      reject(err);
    });
    dump.on("close", (code) => {
      // Only a non-zero exit is a failure. pg_dump writes version notices to
      // stderr on a perfectly good dump, so stderr alone must not fail this.
      if (code !== 0) reject(new Error(`pg_dump exited ${code}: ${stderr.trim().slice(0, 400)}`));
    });
  });

  try {
    await Promise.race([
      pipeline(dump.stdout, zlib.createGzip({ level: 6 }), createWriteStream(file)),
      failed,
    ]);
  } catch (err) {
    // Never leave a half-written dump behind to be mistaken for a real one.
    await fs.rm(file, { force: true }).catch(() => {});
    throw err;
  }

  const { size } = await fs.stat(file);

  // A dump that exists but is empty is worse than no dump, because it looks
  // like a backup. pg_dump on an empty schema still emits a header, so anything
  // under a kilobyte means something went wrong.
  if (size < 1024) {
    await fs.rm(file, { force: true }).catch(() => {});
    throw new Error(`backup was only ${size} bytes — refusing to keep it`);
  }

  return {
    file,
    bytes: size,
    durationMs: Date.now() - started,
    pruned: await prune(now),
  };
}

/** Delete dumps older than the retention window. */
async function prune(now: Date): Promise<string[]> {
  const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const removed: string[] = [];

  const entries = await fs.readdir(DIR).catch(() => [] as string[]);
  for (const name of entries) {
    if (!name.startsWith("codeearly-") || !name.endsWith(".sql.gz")) continue;
    const full = path.join(DIR, name);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat) continue;
    if (stat.mtimeMs < cutoff) {
      await fs.rm(full, { force: true }).catch(() => {});
      removed.push(name);
    }
  }
  return removed;
}

/** Where backups are written — surfaced so checks and ops can find them. */
export const backupDir = DIR;
