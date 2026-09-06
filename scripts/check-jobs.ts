/**
 * The queues actually do something.
 *
 * Before this phase, four of the five queues had no producer and nothing
 * recurred. The stub processors returned normally, so BullMQ marked their jobs
 * COMPLETED — the failed set stayed empty and a dashboard showed green over work
 * that never happened. This check exists so that state cannot come back
 * unnoticed.
 *
 * It asserts three separate things, because they fail independently:
 *   1. the schedules are registered and will fire again
 *   2. a backup really produces a file, and a plausible one
 *   3. an unimplemented processor FAILS rather than reporting success
 *
 *   npx tsx scripts/check-jobs.ts
 *
 * Safe to run against a live database: pg_dump takes a read-only snapshot, and
 * the dump it writes here is deleted afterwards.
 */
import "dotenv/config";
import fs from "node:fs/promises";

import { registerSchedules, listSchedules } from "@/jobs/schedule";
import { runBackup, backupDir } from "@/jobs/backup";
import { backupQueue, reminderQueue, quizQueue, emailQueue, pushQueue } from "@/jobs/queues";
import { redis } from "@/lib/redis";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("Job scheduling and backups\n");

  // ── 1. Schedules ───────────────────────────────────────────────────────────
  console.log("Schedules are registered");
  const registered = await registerSchedules();
  check("registering is idempotent", (await registerSchedules()).length === registered.length);

  const { backup, reminders } = await listSchedules();
  const nightly = backup.find((s) => s.key === "nightly-backup" || s.name === "nightly");
  const expiry = reminders.find(
    (s) => s.key === "daily-subscription-expiry" || s.name === "subscription-expiry"
  );

  check("a nightly backup is scheduled", !!nightly, nightly?.pattern ?? "MISSING");
  check("a daily expiry sweep is scheduled", !!expiry, expiry?.pattern ?? "MISSING");
  // `next` is when it will fire again. A schedule with no next run is inert,
  // which looks identical to a healthy one in a queue listing.
  check("the backup has a next run", !!nightly?.next, nightly?.next ? new Date(nightly.next).toISOString() : "none");
  check("the expiry sweep has a next run", !!expiry?.next, expiry?.next ? new Date(expiry.next).toISOString() : "none");

  // ── 2. The backup is real ──────────────────────────────────────────────────
  console.log("\nA backup produces a restorable file");
  let produced: string | null = null;
  try {
    const result = await runBackup();
    produced = result.file;
    check("pg_dump wrote a file", result.bytes > 0, `${(result.bytes / 1024).toFixed(0)}KB`);
    // The guard inside runBackup rejects anything under a kilobyte, but assert
    // it here too: a dump that exists and is empty is worse than none, because
    // it looks like a backup until the day someone needs it.
    check("it is big enough to be real", result.bytes > 1024);

    const head = await fs.readFile(result.file);
    check("it is gzip (magic bytes 1f 8b)", head[0] === 0x1f && head[1] === 0x8b);
  } catch (err) {
    const msg = (err as Error).message;
    if (/pg_dump not found/.test(msg)) {
      // Running the worker on a host without postgresql-client. The container
      // has it; say so plainly rather than failing a check about the code.
      console.log(`  – skipped: ${msg.split(".")[0]}`);
      console.log("    (the worker image installs postgresql16-client; this check is meaningful there)");
    } else {
      check("pg_dump wrote a file", false, msg.slice(0, 160));
    }
  } finally {
    if (produced) await fs.rm(produced, { force: true }).catch(() => {});
  }
  console.log(`  (backup directory: ${backupDir})`);

  // ── 3. Unimplemented work fails loudly ─────────────────────────────────────
  console.log("\nUnimplemented processors do not report success");
  const probe = await quizQueue.add(
    "finalize-result",
    { kind: "finalize-result", sessionId: "check-jobs-probe" },
    { attempts: 1, removeOnFail: false, removeOnComplete: false }
  );

  // The worker may not be running; this asserts the OUTCOME, whichever way.
  let state = "unknown";
  for (let i = 0; i < 20; i++) {
    state = await probe.getState();
    if (state === "failed" || state === "completed") break;
    await new Promise((r) => setTimeout(r, 500));
  }

  if (state === "waiting" || state === "delayed" || state === "unknown") {
    console.log("  – skipped: no worker consuming the quiz queue (start `npm run worker`)");
  } else {
    check(
      "an unimplemented quiz job FAILS rather than completing",
      state === "failed",
      `state: ${state}`
    );
  }
  await probe.remove().catch(() => {});

  // ── Producer census — the count that started this phase ────────────────────
  console.log("\nQueues have somewhere to get work from");
  const counts = await Promise.all(
    [emailQueue, reminderQueue, quizQueue, backupQueue, pushQueue].map(async (q) => ({
      name: q.name,
      schedulers: (await q.getJobSchedulers(0, 20)).length,
    }))
  );
  for (const c of counts) {
    console.log(`  ${c.name.padEnd(10)} ${c.schedulers} scheduler(s)`);
  }
  check(
    "at least the backup and reminder queues recur",
    counts.filter((c) => c.schedulers > 0).length >= 2
  );

  await Promise.all(
    [emailQueue, reminderQueue, quizQueue, backupQueue, pushQueue].map((q) => q.close())
  );
  await redis.quit().catch(() => {});

  console.log(failures === 0 ? "\n✅ the queues are wired" : `\n❌ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
