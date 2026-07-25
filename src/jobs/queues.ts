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

export const QUEUES = { emailQueue, reminderQueue, quizQueue, backupQueue };

// ── Job payload types (shared contract between producers and the worker) ──────
export type EmailJob = { to: string; subject: string; html: string; text: string };
export type ReminderJob = { kind: "subscription-expiry" | "program-session" | "birthday" };
export type QuizJob = { kind: "finalize-result"; sessionId: string };
export type BackupJob = { kind: "nightly" };
