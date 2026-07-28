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
// Validates the environment at boot. The worker runs in its own container, so
// it must check its own config rather than assume the web container did.
import "@/lib/env";
import { bullConnection } from "@/lib/redis";
import { deliver, isEmailConfigured } from "@/server/email/transport";
import type { EmailJob, ReminderJob, QuizJob, BackupJob, PushJob } from "./queues";
import { expireEndedSubscriptions } from "@/server/payments/subscriptions";
import { expireLapsedOrgPlans } from "@/server/orgs/plans";

const log = (q: string, msg: string, extra?: unknown) =>
  console.log(`[worker:${q}] ${msg}`, extra ?? "");

const workers: Worker[] = [];

workers.push(
  new Worker<EmailJob>("email", async (job: Job<EmailJob>) => {
    // Checks that credentials are COMPLETE, not merely that a host is named.
    // A half-configured transport previously sent the job down the "send" path
    // where nothing was implemented — so mail was neither printed nor
    // delivered, it simply vanished. Silent loss of a verification link is the
    // worst of the three outcomes.
    //
    // Sending is opt-in outside production (EMAIL_SEND=true). Having working
    // credentials on a developer's machine should not mean local signups start
    // mailing real people, and it must not mean a broken mail host makes local
    // signup impossible — the printed link is what keeps dev usable.
    const wantsToSend =
      process.env.NODE_ENV === "production" || process.env.EMAIL_SEND === "true";
    const configured = isEmailConfigured() && wantsToSend;

    if (!configured) {
      // No provider yet. Print the full text body rather than swallowing it —
      // in development the verification link lives in here, and email
      // verification is required to sign in, so hiding it would make local
      // signup impossible. Throwing instead would just fill the DLQ.
      log("email", `NO PROVIDER — printing instead of sending`);
      log("email", `to: ${job.data.to} | subject: ${job.data.subject}`);
      console.log(job.data.text);
      return;
    }

    try {
      const messageId = await deliver(job.data);
      log("email", `sent → ${job.data.to} :: ${job.data.subject} (${messageId})`);
    } catch (err) {
      // Print the body before rethrowing. BullMQ will retry with backoff, but
      // if the mail host is genuinely broken the retries will all fail — and
      // the one thing we must not do is lose the verification link entirely
      // while that is being fixed.
      log("email", `DELIVERY FAILED → ${job.data.to} :: ${job.data.subject}`);
      console.log(job.data.text);
      throw err;
    }
  }, { connection: bullConnection, concurrency: 5 })
);

workers.push(
  new Worker<ReminderJob>("reminders", async (job: Job<ReminderJob>) => {
    log("reminders", `run → ${job.data.kind}`);

    if (job.data.kind === "subscription-expiry") {
      // Both are non-destructive: they downgrade access, never delete anything
      // the customer already has. Safe to run repeatedly — each only touches
      // rows whose end date has actually passed.
      const [members, orgs] = await Promise.all([
        expireEndedSubscriptions(),
        expireLapsedOrgPlans(),
      ]);
      log("reminders", `expired ${members} subscription(s), ${orgs} org plan(s)`);
      return;
    }

    // TODO(Phase 3): program session reminders, birthdays.
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

// The `push` queue existed with no consumer, so any native notification we
// enqueued would have sat in Redis forever. A stub that logs is not a feature,
// but it does mean the queue drains and failures are visible.
workers.push(
  new Worker<PushJob>("push", async (job: Job<PushJob>) => {
    log("push", `${job.data.tokens.length} device(s) :: ${job.data.title}`);
    // TODO(mobile): FCM/APNs delivery once the Capacitor app registers tokens.
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
