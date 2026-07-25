/**
 * BullMQ worker process — runs in its own container (see docker-compose
 * `worker` service). Consumes the queues defined in ./queues.ts.
 *
 * Phase 0: handlers are stubs that log. Phases 1+ fill them in (real email
 * sending via Resend/SMTP, reminder scans, quiz result finalization + PDF,
 * nightly pg_dump backups). Kept as a separate process so heavy/slow work
 * never blocks web requests.
 */
import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { bullConnection } from "@/lib/redis";
import type { EmailJob, ReminderJob, QuizJob, BackupJob } from "./queues";

const log = (q: string, msg: string, extra?: unknown) =>
  console.log(`[worker:${q}] ${msg}`, extra ?? "");

const workers: Worker[] = [];

workers.push(
  new Worker<EmailJob>("email", async (job: Job<EmailJob>) => {
    log("email", `send → ${job.data.to} :: ${job.data.subject}`);
    // TODO(Phase 2): Resend primary + SMTP fallback, provider rate limits.
  }, { connection: bullConnection, concurrency: 5 })
);

workers.push(
  new Worker<ReminderJob>("reminders", async (job: Job<ReminderJob>) => {
    log("reminders", `run → ${job.data.kind}`);
    // TODO(Phase 3): scan due subscriptions/sessions/birthdays, enqueue emails.
  }, { connection: bullConnection })
);

workers.push(
  new Worker<QuizJob>("quiz", async (job: Job<QuizJob>) => {
    log("quiz", `${job.data.kind} → session ${job.data.sessionId}`);
    // TODO(Phase 4): compute ranks, write QuizResult, render PDF to R2.
  }, { connection: bullConnection })
);

workers.push(
  new Worker<BackupJob>("backup", async (job: Job<BackupJob>) => {
    log("backup", `run → ${job.data.kind}`);
    // TODO(Phase 6): pg_dump → R2 with retention.
  }, { connection: bullConnection })
);

for (const w of workers) {
  w.on("failed", (job, err) => console.error(`[worker] ${w.name} job ${job?.id} failed:`, err.message));
}

console.log(`✅ CodeEarly worker up — queues: ${workers.map(w => w.name).join(", ")}`);

async function shutdown() {
  console.log("Worker shutting down…");
  await Promise.all(workers.map(w => w.close()));
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
