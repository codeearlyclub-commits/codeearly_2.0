/**
 * Join a quiz: POST /api/quiz/join
 *
 * Joining happens over HTTP, not over the socket, so that the socket handshake
 * is a pure check. A flood of socket connections therefore cannot create
 * participant rows, and rate limiting has somewhere sensible to live.
 *
 * Returns the participantId and, for guests, the guestToken the socket will
 * need. The token is the only thing stopping another player in the room from
 * reconnecting as someone else.
 */
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { getChild, getParentSession } from "@/lib/session";
import { findSessionByJoinCode } from "@/server/quiz/join-code";
import { joinSession } from "@/server/quiz/session";
import { errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  /** Guests arrive with a code; members can pass a sessionId from the portal. */
  joinCode: z.string().trim().length(6).optional(),
  sessionId: z.string().trim().min(1).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  /** Returned by a previous join; lets a dropped player reclaim their seat. */
  guestToken: z.string().trim().max(120).optional(),
});

export const POST = apiHandler(async (req) => {
  const body = await parseBody(req, schema);

  // Rate limited by IP before the lookup — this is the enumeration defence for
  // six-digit room codes, and it has to bite before we touch the database.
  await enforceRateLimit(
    `joincode:${clientIp(req)}`,
    LIMITS.joinCodeAttempt.limit,
    LIMITS.joinCodeAttempt.window,
    "Too many attempts. Wait a moment and try again."
  );

  // Resolve the room.
  let sessionId: string;
  let visibility: string;
  if (body.joinCode) {
    const found = await findSessionByJoinCode(body.joinCode);
    sessionId = found.id;
    visibility = found.competition.visibility;
  } else if (body.sessionId) {
    const found = await prisma.quizSession.findUnique({
      where: { id: body.sessionId },
      include: { competition: { select: { visibility: true } } },
    });
    if (!found || found.phase === "ENDED") throw errors.notFound("No live quiz found.");
    sessionId = found.id;
    visibility = found.competition.visibility;
  } else {
    throw errors.validation("Enter a join code.");
  }

  // A signed-in child plays as themselves; anyone else is a guest.
  const child = await getChild(req);

  if (child) {
    const result = await joinSession(sessionId, {
      kind: "member",
      childId: child.childId,
      displayName: child.displayName,
    });
    return {
      sessionId,
      participantId: result.participant.id,
      displayName: result.participant.displayName,
      rejoined: result.rejoined,
    };
  }

  // MEMBERS-only quizzes never accept guests, whatever they send.
  if (visibility === "MEMBERS") {
    // A parent's session is not a player: quizzes are played by children.
    const parent = await getParentSession(req);
    throw parent
      ? errors.forbidden("Your child signs in with their own code to play.")
      : errors.unauthenticated("This quiz is for CodeEarly members. Ask your parent to sign you in.");
  }

  if (!body.displayName) throw errors.validation("Enter the name you want on the scoreboard.");

  const result = await joinSession(sessionId, {
    kind: "guest",
    displayName: body.displayName,
    guestToken: body.guestToken,
  });

  return {
    sessionId,
    participantId: result.participant.id,
    displayName: result.participant.displayName,
    // Client stores this; it is how a dropped guest gets their seat back.
    guestToken: result.guestToken,
    rejoined: result.rejoined,
    awaitingApproval: !result.participant.approved,
  };
});
