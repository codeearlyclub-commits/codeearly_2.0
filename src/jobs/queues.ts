import { Queue } from "bullmq";
import { bullConnection } from "@/lib/redis";

/**
 * BullMQ queues — the backbone that replaces V4's single Vercel cron. Producers
 * (API routes, services) add jobs here; the worker process consumes them.
 * Redis-backed, so jobs survive restarts and retry with backoff.
 */
export const emailQueue = new Queue("email", { connection: bullConnection });
export const reminderQueue = new Queue("reminders", { connection: bullConnection });
export const quizQueue = new Queue("quiz", { connection: bullConnection });
export const backupQueue = new Queue("backup", { connection: bullConnection });
// Native push for the Capacitor app (ARCHITECTURE §7b) — class and quiz
// reminders go out through here to FCM/APNs, never inline on a request.
export const pushQueue = new Queue("push", { connection: bullConnection });

export const QUEUES = {
  emailQueue,
  reminderQueue,
  quizQueue,
  backupQueue,
  pushQueue,
};

// ── Job payload types (shared contract between producers and the worker) ──────
export type EmailJob = { to: string; subject: string; html: string; text: string };
export type ReminderJob = { kind: "subscription-expiry" | "program-session" | "birthday" };
export type QuizJob =
  | { kind: "finalize-result"; sessionId: string }
  /** Result PDFs are a paid entitlement and slow to render — never on the request path. */
  | { kind: "generate-result-pdf"; sessionId: string; organizationId: string }
  /** Frees the room PIN and archives the session once a quiz ends. */
  | { kind: "release-join-code"; sessionId: string };
export type BackupJob = { kind: "nightly" };
export type PushJob = {
  /** Device tokens registered by the Capacitor app. */
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
};
