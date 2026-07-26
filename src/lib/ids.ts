/**
 * Identifier generation.
 *
 * All randomness comes from node:crypto — never Math.random(). Membership IDs
 * and join codes are guessable-by-design targets (a stranger who guesses a live
 * join code lands in a room with children in it), so they use a CSPRNG and a
 * uniform distribution.
 */
import { randomInt, randomBytes } from "node:crypto";

import { JOIN_CODE_LENGTH } from "@/lib/constants";

/**
 * Alphabet for human-readable IDs. Excludes 0/O, 1/I/L and vowels — the first
 * to stop people mistyping a membership ID over the phone, the second so a
 * random string can never spell something a parent has to read out loud.
 */
const READABLE = "BCDFGHJKMNPQRSTVWXYZ23456789";

function readableString(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += READABLE[randomInt(READABLE.length)];
  return out;
}

/**
 * Membership ID: `CE-2026-K7QX`.
 *
 * The suffix is random rather than sequential on purpose — a sequential ID
 * tells anyone holding one exactly how many children are enrolled, and lets
 * them enumerate the others.
 */
export function generateMembershipId(year = new Date().getFullYear()): string {
  return `CE-${year}-${readableString(4)}`;
}

/**
 * Invoice number: `CEC-2026-0042`.
 *
 * Invoice numbers must be gapless and sequential for accounting, so the counter
 * cannot be random — pass the next value from a database sequence inside the
 * same transaction that writes the invoice.
 */
export function formatInvoiceNumber(
  sequence: number,
  year = new Date().getFullYear()
): string {
  return `CEC-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Room PIN for guest players: 6 digits, uniformly random.
 *
 * Digits only because children type these on phones under time pressure.
 * Uniqueness is enforced by the database (`QuizSession.joinCode` is unique);
 * callers retry on collision rather than trusting the generator.
 */
export function generateJoinCode(length = JOIN_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(randomInt(10));
  return out;
}

/**
 * Opaque token that lets a guest player reclaim their own seat after a
 * disconnect. Long and random so it cannot be guessed by another player in the
 * room — it is the only thing standing between a guest's score and a stranger.
 */
export function generateGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

/** URL-safe slug from a name, e.g. "St. Mary's Academy" → "st-marys-academy". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
