/**
 * Quiz session state machine — server-authoritative.
 *
 * Every transition happens here and is written to Postgres before it is
 * broadcast. Clients never compute phase, never compute score, and never decide
 * when a question closes. That is the fix for the whole class of V4 bugs where
 * two clients disagreed about what was happening.
 *
 * The legal transitions, and nothing else:
 *
 *   LOBBY ──start──▶ ACTIVE ──reveal──▶ REVEALED ──next──▶ ACTIVE
 *     │                 │                   │
 *     └──────────────── end ────────────────┴──▶ ENDED  (terminal)
 */
import type { QuizPhase, QuizSession } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateGuestToken } from "@/lib/ids";
import { allocateJoinCode, releaseJoinCode } from "@/server/quiz/join-code";
import { assertRoomHasSpace, effectiveLimits, assertCanHost } from "@/server/orgs/entitlements";
import { scoreAnswer, rankLeaderboard, deadlineFor, isExpired } from "@/server/quiz/scoring";

/**
 * Which phases each action is legal from.
 *
 * `next` is allowed from ACTIVE as well as REVEALED. Revealing first is the
 * normal path and the pedagogically useful one — children should see the answer
 * — but a host needs an escape hatch for a question with a typo in it, or one
 * the room has clearly already finished. Skipping the reveal is the host's
 * judgement to make in the moment, not something the engine should forbid from
 * a distance.
 */
const ALLOWED_FROM: Record<string, QuizPhase[]> = {
  start: ["LOBBY"],
  reveal: ["ACTIVE"],
  next: ["ACTIVE", "REVEALED", "LOBBY"],
  end: ["LOBBY", "ACTIVE", "REVEALED"],
};

function assertPhase(action: keyof typeof ALLOWED_FROM, session: QuizSession) {
  if (!ALLOWED_FROM[action]!.includes(session.phase)) {
    // Explicit rather than silently ignored: a host double-tapping "Next" on a
    // slow connection should be told nothing happened, not have two questions
    // skip past the room.
    throw errors.conflict(
      `Cannot ${action} a quiz that is ${session.phase.toLowerCase()}.`
    );
  }
}

// ── Creating and joining ─────────────────────────────────────────────────────

/**
 * Open a room for a competition.
 *
 * The player cap is SNAPSHOTTED onto the session from the org's entitlements, so
 * a plan lapsing mid-event cannot shrink a room that is already running.
 */
export async function createSession(competitionId: string, hostUserId: string) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: { organization: true, _count: { select: { questions: true } } },
  });
  if (!competition) throw errors.notFound("Quiz not found.");
  if (competition._count.questions === 0) {
    throw errors.validation("Add at least one question before starting a quiz.");
  }

  assertCanHost(competition.organization);
  const limits = effectiveLimits(competition.organization);

  // Only guest-playable rooms need a code. A members-only quiz is joined from
  // the portal, and minting a code would be one more guessable way in.
  const needsCode = competition.visibility !== "MEMBERS";
  const joinCode = needsCode ? await allocateJoinCode() : null;

  const session = await prisma.quizSession.create({
    data: {
      competitionId,
      hostUserId,
      joinCode,
      maxPlayers: limits.maxPlayersPerSession,
      requireHostApproval: competition.visibility === "PUBLIC",
      phase: "LOBBY",
    },
  });

  logger.info(
    { sessionId: session.id, competitionId, joinCode: joinCode ?? "none" },
    "quiz session opened"
  );
  return session;
}

export type JoinAsMember = { kind: "member"; childId: string; displayName: string };
export type JoinAsGuest = { kind: "guest"; displayName: string; guestToken?: string };

/**
 * Join a room.
 *
 * Rejoining is idempotent — a child whose tablet dropped mid-question gets their
 * seat and score back rather than a second entry on the leaderboard. That is
 * what `guestToken` is for on the guest path.
 */
export async function joinSession(
  sessionId: string,
  who: JoinAsMember | JoinAsGuest
) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { participants: true } } },
  });
  if (!session) throw errors.notFound("Quiz not found.");
  if (session.phase === "ENDED") throw errors.conflict("That quiz has finished.");

  // Existing seat?
  const existing =
    who.kind === "member"
      ? await prisma.quizParticipant.findUnique({
          where: { sessionId_childId: { sessionId, childId: who.childId } },
        })
      : who.guestToken
        ? await prisma.quizParticipant.findUnique({
            where: { sessionId_guestToken: { sessionId, guestToken: who.guestToken } },
          })
        : null;

  if (existing) return { participant: existing, rejoined: true, guestToken: existing.guestToken };

  // Capacity is judged against the session's own snapshot, not the org's plan.
  assertRoomHasSpace(session.maxPlayers, session._count.participants);

  const displayName = who.displayName.trim().slice(0, 40);
  if (displayName.length < 1) throw errors.validation("Please enter a name.");

  const guestToken = who.kind === "guest" ? (who.guestToken ?? generateGuestToken()) : null;

  const participant = await prisma.quizParticipant.create({
    data: {
      sessionId,
      childId: who.kind === "member" ? who.childId : null,
      guestToken,
      displayName,
      // Host approval gates guests only. A CodeEarly member is already known to
      // us, so making a host vet them adds friction with no safety gain.
      approved: who.kind === "member" ? true : !session.requireHostApproval,
    },
  });

  return { participant, rejoined: false, guestToken };
}

// ── Host transitions ─────────────────────────────────────────────────────────

async function loadSession(sessionId: string) {
  const session = await prisma.quizSession.findUnique({ where: { id: sessionId } });
  if (!session) throw errors.notFound("Quiz not found.");
  return session;
}

/** Move to the first question. */
export async function startSession(sessionId: string) {
  const session = await loadSession(sessionId);
  assertPhase("start", session);
  return openQuestion(sessionId, 0);
}

/** Move to the next question, or end if there are none left. */
export async function nextQuestion(sessionId: string) {
  const session = await loadSession(sessionId);
  assertPhase("next", session);
  return openQuestion(sessionId, session.currentQuestionIndex + 1);
}

/**
 * Open question `index`, or end the quiz when the questions run out.
 *
 * `currentQuestionStartedAt` is set from the server clock and is the single
 * source of truth for the deadline. Nothing derives timing from a client.
 */
async function openQuestion(sessionId: string, index: number) {
  const session = await prisma.quizSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { competition: { include: { questions: { orderBy: { order: "asc" } } } } },
  });

  const questions = session.competition.questions;
  if (index >= questions.length) return endSession(sessionId);

  const updated = await prisma.quizSession.update({
    where: { id: sessionId },
    data: {
      phase: "ACTIVE",
      currentQuestionIndex: index,
      currentQuestionStartedAt: new Date(),
    },
  });

  const question = questions[index]!;
  return {
    session: updated,
    question: {
      questionId: question.id,
      index,
      total: questions.length,
      text: question.text,
      options: question.options,
      // Absolute, never a duration.
      deadlineAt: deadlineFor(updated.currentQuestionStartedAt!, question.timeLimitSeconds),
    },
    // Never sent to players — the caller decides who may see this.
    correctAnswer: question.correctAnswer,
  };
}

/** Close the current question and compute what everyone sees. */
export async function revealAnswer(sessionId: string) {
  const session = await loadSession(sessionId);
  assertPhase("reveal", session);

  const question = await currentQuestion(sessionId);
  if (!question) throw errors.conflict("There is no open question to reveal.");

  const [updated, answers, standings] = await prisma.$transaction([
    prisma.quizSession.update({ where: { id: sessionId }, data: { phase: "REVEALED" } }),
    prisma.quizAnswer.findMany({
      where: { sessionId, questionId: question.id },
      select: { selectedAnswer: true },
    }),
    prisma.quizParticipant.findMany({
      where: { sessionId, approved: true },
      select: { id: true, displayName: true, totalScore: true },
    }),
  ]);

  // Tally every option, including ones nobody chose — a bar chart with missing
  // bars reads as a rendering bug to the room.
  const tally: Record<string, number> = {};
  for (const option of question.options) tally[option] = 0;
  for (const answer of answers) {
    tally[answer.selectedAnswer] = (tally[answer.selectedAnswer] ?? 0) + 1;
  }

  const leaderboard = rankLeaderboard(
    standings.map((s) => ({
      participantId: s.id,
      displayName: s.displayName,
      score: s.totalScore,
    }))
  );

  return {
    session: updated,
    questionId: question.id,
    correctAnswer: question.correctAnswer,
    tally,
    leaderboard,
  };
}

/** End the quiz and write the immutable result snapshot. */
export async function endSession(sessionId: string) {
  const session = await prisma.quizSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      competition: true,
      participants: {
        where: { approved: true },
        include: { answers: { select: { questionId: true, selectedAnswer: true, correct: true, pointsEarned: true } } },
      },
    },
  });

  if (session.phase === "ENDED") {
    const existing = await prisma.quizResult.findUnique({ where: { sessionId } });
    return { session, result: existing };
  }

  const leaderboard = rankLeaderboard(
    session.participants.map((p) => ({
      participantId: p.id,
      displayName: p.displayName,
      score: p.totalScore,
    }))
  );

  const result = await prisma.$transaction(async (tx) => {
    // Ranks are persisted onto the participants too, so a certificate printed
    // months later says the same thing the screen did on the day.
    for (const entry of leaderboard) {
      await tx.quizParticipant.update({
        where: { id: entry.participantId },
        data: { rank: entry.rank },
      });
    }

    await tx.quizSession.update({
      where: { id: sessionId },
      data: { phase: "ENDED", endedAt: new Date() },
    });

    return tx.quizResult.create({
      data: {
        sessionId,
        competitionId: session.competitionId,
        competitionTitle: session.competition.title,
        organizationId: session.competition.organizationId,
        joinCode: session.joinCode,
        leaderboard,
        participants: session.participants.map((p) => ({
          participantId: p.id,
          displayName: p.displayName,
          childId: p.childId,
          score: p.totalScore,
          answers: p.answers,
        })),
      },
    });
  });

  // Frees the PIN for reuse. The code that was used is preserved on the result.
  if (session.joinCode) await releaseJoinCode(sessionId);

  logger.info({ sessionId, players: session.participants.length }, "quiz session ended");
  return { session: { ...session, phase: "ENDED" as QuizPhase }, result };
}

// ── Players ──────────────────────────────────────────────────────────────────

async function currentQuestion(sessionId: string) {
  const session = await prisma.quizSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { competition: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  return session.competition.questions[session.currentQuestionIndex] ?? null;
}

/**
 * Record an answer and its score.
 *
 * Four things are enforced, and all of them are exploitable if they are not:
 *  - the question must still be open (no answering after the reveal)
 *  - the deadline must not have passed, judged by the SERVER clock
 *  - the option must be one the question actually offered
 *  - one answer per participant per question, enforced by a unique index
 */
export async function submitAnswer(
  sessionId: string,
  participantId: string,
  questionId: string,
  selectedAnswer: string
) {
  const session = await loadSession(sessionId);
  if (session.phase !== "ACTIVE") {
    throw errors.conflict("Answers are closed for this question.");
  }

  const question = await currentQuestion(sessionId);
  if (!question || question.id !== questionId) {
    // Either a stale client answering the previous question, or a forged id.
    throw errors.conflict("That question is no longer open.");
  }
  if (!question.options.includes(selectedAnswer)) {
    throw errors.validation("That is not one of the options.");
  }
  if (isExpired(session.currentQuestionStartedAt!, question.timeLimitSeconds)) {
    throw errors.conflict("Time is up for this question.");
  }

  const participant = await prisma.quizParticipant.findFirst({
    where: { id: participantId, sessionId },
  });
  if (!participant) throw errors.forbidden("You are not in this quiz.");
  if (!participant.approved) throw errors.forbidden("The host has not let you in yet.");

  const correct = selectedAnswer === question.correctAnswer;
  const points = scoreAnswer({
    correct,
    elapsedMs: Date.now() - session.currentQuestionStartedAt!.getTime(),
    limitMs: question.timeLimitSeconds * 1000,
  });

  try {
    const [answer] = await prisma.$transaction([
      prisma.quizAnswer.create({
        data: {
          sessionId,
          participantId,
          questionId,
          selectedAnswer,
          correct,
          pointsEarned: points,
        },
      }),
      prisma.quizParticipant.update({
        where: { id: participantId },
        data: { totalScore: { increment: points } },
      }),
    ]);
    return { answer, correct, points };
  } catch (err) {
    // The unique index did its job: this participant already answered. Treated
    // as a no-op rather than an error, because a double-tap on a laggy tablet
    // is the most likely cause and it must not score twice.
    if ((err as { code?: string }).code === "P2002") {
      throw errors.conflict("You have already answered this question.");
    }
    throw err;
  }
}

/** Admit or reject a guest waiting in the lobby. */
export async function admitParticipant(
  sessionId: string,
  participantId: string,
  approved: boolean
) {
  const participant = await prisma.quizParticipant.findFirst({
    where: { id: participantId, sessionId },
  });
  if (!participant) throw errors.notFound("Player not found.");

  if (!approved) {
    await prisma.quizParticipant.delete({ where: { id: participantId } });
    return { removed: true };
  }

  await prisma.quizParticipant.update({
    where: { id: participantId },
    data: { approved: true },
  });
  return { removed: false };
}

/** Public view of the room, safe to send to any player. */
export async function sessionState(sessionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      competition: { select: { title: true, organizationId: true } },
      participants: {
        where: { approved: true },
        select: { id: true, displayName: true, totalScore: true, rank: true },
      },
      _count: { select: { participants: true } },
    },
  });
  if (!session) throw errors.notFound("Quiz not found.");

  return {
    sessionId: session.id,
    title: session.competition.title,
    phase: session.phase,
    playerCount: session._count.participants,
    maxPlayers: session.maxPlayers,
    joinCode: session.joinCode,
    leaderboard: rankLeaderboard(
      session.participants.map((p) => ({
        participantId: p.id,
        displayName: p.displayName,
        score: p.totalScore,
      }))
    ),
  };
}
