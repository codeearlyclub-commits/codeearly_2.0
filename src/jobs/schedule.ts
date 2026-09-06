/**
 * Repeatable jobs.
 *
 * THIS IS THE PIECE THAT WAS MISSING. Four of the five queues had no producer
 * anywhere in the codebase and nothing recurred — no scheduler, no cron, no
 * repeatable job. So the backup had two independent reasons never to run, and
 * `expireEndedSubscriptions` was correct, tested, and dead: nothing ever called
 * it.
 *
 * Registered from the worker on boot rather than from the web app, because the
 * worker is the process that consumes them and there is exactly one of it. Two
 * app containers registering the same schedule would be harmless — the id makes
 * it an upsert — but the ownership would be unclear.
 */
import { backupQueue, reminderQueue, type BackupJob, type ReminderJob } from "./queues";

/**
 * Africa/Lagos, not UTC.
 *
 * "Nightly" has to mean night where the data is. In UTC, 03:00 Lagos is 02:00,
 * and a schedule that drifts into the school run is a schedule someone
 * eventually turns off.
 */
const TZ = process.env.SCHEDULE_TZ ?? "Africa/Lagos";

type Registered = { queue: string; id: string; pattern: string };

export async function registerSchedules(): Promise<Registered[]> {
  const registered: Registered[] = [];

  // 03:00 — after the day's writes, before anyone is awake to notice the load.
  const backupPattern = process.env.BACKUP_CRON ?? "0 3 * * *";
  await backupQueue.upsertJobScheduler(
    "nightly-backup",
    { pattern: backupPattern, tz: TZ },
    { name: "nightly", data: { kind: "nightly" } satisfies BackupJob }
  );
  registered.push({ queue: "backup", id: "nightly-backup", pattern: backupPattern });

  // 06:00 — expiry enforcement should have happened before a parent opens the
  // portal and sees access they no longer pay for.
  const expiryPattern = process.env.EXPIRY_CRON ?? "0 6 * * *";
  await reminderQueue.upsertJobScheduler(
    "daily-subscription-expiry",
    { pattern: expiryPattern, tz: TZ },
    { name: "subscription-expiry", data: { kind: "subscription-expiry" } satisfies ReminderJob }
  );
  registered.push({ queue: "reminders", id: "daily-subscription-expiry", pattern: expiryPattern });

  return registered;
}

/** What is actually registered right now — used by `check-jobs.ts` and ops. */
export async function listSchedules() {
  const [backups, reminders] = await Promise.all([
    backupQueue.getJobSchedulers(0, 50),
    reminderQueue.getJobSchedulers(0, 50),
  ]);
  return { backup: backups, reminders };
}
