/**
 * Join codes — the room PINs guests type to enter a live quiz.
 *
 * Two properties matter and they pull against each other:
 *   • short enough for a child to type off a projector under time pressure
 *   • not enumerable, because whoever holds a live code is in a room with
 *     children in it
 *
 * Six digits gives a million combinations, which is not enough on its own — so
 * the defence is layered: codes exist only while a session is live, they are
 * released the moment it ends, and lookups are rate-limited per IP
 * (`LIMITS.joinCodeAttempt`). Guessing must be slow, not merely unlikely.
 */
import { prisma } from "@/lib/prisma";
import { generateJoinCode } from "@/lib/ids";
import { errors } from "@/lib/errors";

/** How many times to retry when a generated code is already taken. */
const MAX_ATTEMPTS = 10;

/**
 * Reserve an unused join code.
 *
 * Uniqueness is the database's job (`QuizSession.joinCode` is unique) — this
 * only avoids the obvious collisions up front. The caller still writes inside a
 * transaction and retries on a unique-constraint violation, because two
 * requests can pass this check simultaneously.
 */
export async function allocateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateJoinCode();
    const taken = await prisma.quizSession.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  // A million codes and ten collisions in a row means something is very wrong
  // (or we have far more live rooms than the pool supports) — fail loudly.
  throw errors.internal("Could not allocate a join code. Please try again.");
}

/**
 * Resolve a code to a joinable session.
 *
 * Returns only what a not-yet-joined stranger is allowed to know: enough to
 * render the lobby, nothing about who else is in the room. Callers MUST have
 * rate-limited the attempt before calling this.
 */
export async function findSessionByJoinCode(code: string) {
  const normalised = code.trim();
  if (!/^\d{6}$/.test(normalised)) {
    throw errors.validation("A join code is 6 digits.");
  }

  const session = await prisma.quizSession.findUnique({
    where: { joinCode: normalised },
    select: {
      id: true,
      phase: true,
      maxPlayers: true,
      requireHostApproval: true,
      competition: {
        select: {
          id: true,
          title: true,
          visibility: true,
          organizationId: true,
          organization: { select: { name: true, logoUrl: true, brandColor: true } },
        },
      },
      _count: { select: { participants: true } },
    },
  });

  // Same error whether the code is wrong or the room has ended — a distinct
  // "that room is over" reply would confirm the code was real and turn the
  // endpoint into an oracle for enumeration.
  if (!session || session.phase === "ENDED") {
    throw errors.notFound("No live quiz found with that code.");
  }

  return session;
}

/**
 * Release a code back into the pool when a session ends. The code that was used
 * is preserved on `QuizResult.joinCode` for support and audit.
 */
export async function releaseJoinCode(sessionId: string): Promise<void> {
  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { joinCode: null },
  });
}
