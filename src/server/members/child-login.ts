/**
 * Student sign-in — the child's own restricted access.
 *
 * A parent issues a short code and a PIN. There is no email, no password reset
 * flow, and no way for the child to change their own credentials: if it's lost,
 * the parent reissues it. That is the whole point — we never hold a credential
 * a child is responsible for keeping secret from their parent.
 *
 * A 4-digit PIN is only 10,000 values, so the hash is not the defence. The
 * defences are: the code itself (28^6 ≈ 480 million), a hard lockout after a
 * few wrong PINs, and IP rate limiting above this layer.
 */
import { randomInt, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { Child } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { revokeAllChildSessions } from "@/lib/child-session";
import { getOwnedChild } from "@/server/members/children";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/** Wrong PINs before the login locks. */
const MAX_PIN_ATTEMPTS = 5;
/** How long a locked login stays locked. Long enough to make guessing useless. */
const LOCKOUT_MINUTES = 15;

const PIN_LENGTH = 4;
const CODE_LENGTH = 6;
/** No 0/O or 1/I — a child reading this off a card should not have to guess. */
const CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";

// ── Hashing ──────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = await scrypt(pin, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  // Constant-time: a timing difference would leak how much of the hash matched.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

function randomPin(): string {
  let out = "";
  for (let i = 0; i < PIN_LENGTH; i++) out += String(randomInt(10));
  return out;
}

// ── Parent-facing operations ─────────────────────────────────────────────────

/**
 * Turn on (or regenerate) a child's student login.
 *
 * Returns the code and PIN in **plaintext exactly once** — they are hashed on
 * the way in and can never be read back. If the parent loses them, they reissue.
 * Any existing sessions are killed immediately, so regenerating is also the
 * "someone else knows my child's PIN" panic button.
 */
export async function issueStudentLogin(
  parentId: string,
  childId: string
): Promise<{ loginCode: string; pin: string }> {
  await getOwnedChild(parentId, childId); // authorise first

  const pin = randomPin();
  const pinHash = await hashPin(pin);

  for (let attempt = 0; attempt < 8; attempt++) {
    const loginCode = randomCode();
    try {
      await prisma.child.update({
        where: { id: childId },
        data: {
          loginCode,
          pinHash,
          loginEnabled: true,
          pinUpdatedAt: new Date(),
          failedPinAttempts: 0,
          lockedUntil: null,
        },
      });
      await revokeAllChildSessions(childId);
      return { loginCode, pin };
    } catch (err) {
      if (isUniqueViolation(err, "loginCode")) continue;
      throw err;
    }
  }
  throw errors.internal("Could not create a student login. Please try again.");
}

/** Turn off student sign-in and kill every live session for that child. */
export async function disableStudentLogin(parentId: string, childId: string): Promise<void> {
  await getOwnedChild(parentId, childId);
  await prisma.child.update({
    where: { id: childId },
    data: {
      loginEnabled: false,
      loginCode: null,
      pinHash: null,
      failedPinAttempts: 0,
      lockedUntil: null,
    },
  });
  await revokeAllChildSessions(childId);
}

// ── Child-facing operation ───────────────────────────────────────────────────

/**
 * Verify a code + PIN.
 *
 * Every failure returns the SAME error regardless of cause — unknown code,
 * disabled login, or wrong PIN. Distinguishing them would let someone probe for
 * which codes belong to real children.
 *
 * Callers MUST rate-limit by IP before calling this (`LIMITS.login`); the
 * per-child lockout here stops one child's PIN being brute-forced, not an
 * attacker sweeping many codes.
 */
export async function verifyStudentLogin(
  loginCodeInput: string,
  pinInput: string
): Promise<Child> {
  const loginCode = loginCodeInput.trim().toUpperCase();
  const pin = pinInput.trim();
  const rejected = () => errors.unauthenticated("That code or PIN isn't right.");

  if (!/^[A-Z0-9]{6}$/.test(loginCode) || !/^\d{4}$/.test(pin)) throw rejected();

  const child = await prisma.child.findUnique({ where: { loginCode } });
  if (!child || !child.loginEnabled || !child.pinHash) throw rejected();

  if (child.lockedUntil && child.lockedUntil > new Date()) {
    // The one case we DO distinguish: a locked-out child needs to be told why,
    // and by this point the code was already correct, so nothing extra leaks.
    throw errors.rateLimited(
      "Too many wrong PINs. Ask your parent to help you try again later."
    );
  }

  if (!(await verifyPin(pin, child.pinHash))) {
    const attempts = child.failedPinAttempts + 1;
    const locked = attempts >= MAX_PIN_ATTEMPTS;
    await prisma.child.update({
      where: { id: child.id },
      data: {
        failedPinAttempts: locked ? 0 : attempts,
        lockedUntil: locked
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : child.lockedUntil,
      },
    });
    throw rejected();
  }

  if (child.failedPinAttempts !== 0 || child.lockedUntil !== null) {
    await prisma.child.update({
      where: { id: child.id },
      data: { failedPinAttempts: 0, lockedUntil: null },
    });
  }

  return child;
}

function isUniqueViolation(err: unknown, field: string): boolean {
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}
