/**
 * Drives a whole quiz through the state machine and asserts the rules that
 * matter in front of a room full of children.
 *
 *   npx tsx scripts/check-quiz-engine.ts
 *
 * No socket involved — this tests the authority, not the transport. If these
 * rules hold here they hold for every client, because clients only ever ask the
 * server to do these things.
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { SYSTEM_ORG_ID } from "@/lib/constants";
import { createCompetition } from "@/server/quiz/admin";
import {
  createSession,
  joinSession,
  startSession,
  submitAnswer,
  revealAnswer,
  nextQuestion,
  endSession,
  sessionState,
} from "@/server/quiz/session";
import { isAppError } from "@/lib/errors";

const HOST_ID = "quiz-check-host";
const TITLE = "Quiz Engine Check";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Assert that an action is refused, and report the message it gave. */
async function refuses(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "IT WAS ALLOWED");
  } catch (err) {
    check(label, isAppError(err), isAppError(err) ? err.publicMessage : String(err));
  }
}

async function main() {
  await cleanup();

  await prisma.user.create({
    data: {
      id: HOST_ID,
      email: "quiz-check-host@example.com",
      name: "Quiz Host",
      role: "admin",
      emailVerified: true,
      updatedAt: new Date(),
    },
  });

  const competition = await createCompetition(
    {
      title: TITLE,
      description: null,
      type: "quiz",
      status: "upcoming",
      visibility: "UNLISTED",
      questions: [
        { text: "Q1?", options: ["right", "wrong"], correctAnswer: "right", timeLimitSeconds: 30 },
        { text: "Q2?", options: ["yes", "no"], correctAnswer: "yes", timeLimitSeconds: 30 },
      ],
    },
    SYSTEM_ORG_ID
  );

  // ── Opening a room ─────────────────────────────────────────────────────────
  const session = await createSession(competition.id, HOST_ID);
  check("room opens in LOBBY", session.phase === "LOBBY", session.phase);
  check("guest-playable room gets a 6-digit code", /^\d{6}$/.test(session.joinCode ?? ""), session.joinCode ?? "none");

  // ── Joining ────────────────────────────────────────────────────────────────
  const fast = await joinSession(session.id, { kind: "guest", displayName: "Fast" });
  const slow = await joinSession(session.id, { kind: "guest", displayName: "Slow" });
  const wrong = await joinSession(session.id, { kind: "guest", displayName: "Wrong" });
  check("three guests joined", Boolean(fast.guestToken && slow.guestToken && wrong.guestToken));

  const rejoin = await joinSession(session.id, {
    kind: "guest",
    displayName: "Fast",
    guestToken: fast.guestToken!,
  });
  // A dropped tablet must get its seat back, not a second row on the scoreboard.
  check("rejoining with the token reclaims the same seat", rejoin.participant.id === fast.participant.id);
  check("rejoin is reported as a rejoin", rejoin.rejoined === true);

  await refuses("cannot reveal before starting", () => revealAnswer(session.id));

  // ── Question 1 ─────────────────────────────────────────────────────────────
  const started = await startSession(session.id);
  const q1 = "question" in started ? started.question : null;
  check("start opens question 1", q1?.index === 0, `index ${q1?.index}`);
  check("deadline is an absolute instant in the future", (q1?.deadlineAt ?? 0) > Date.now());
  check(
    "question payload carries no correct answer",
    q1 !== null && !("correctAnswer" in (q1 as object))
  );

  await submitAnswer(session.id, fast.participant.id, q1!.questionId, "right");
  await new Promise((r) => setTimeout(r, 1200));
  await submitAnswer(session.id, slow.participant.id, q1!.questionId, "right");
  await submitAnswer(session.id, wrong.participant.id, q1!.questionId, "wrong");

  await refuses("cannot answer the same question twice", () =>
    submitAnswer(session.id, fast.participant.id, q1!.questionId, "right")
  );
  await refuses("cannot answer with an option that was not offered", () =>
    submitAnswer(session.id, slow.participant.id, q1!.questionId, "banana")
  );

  const scores = await prisma.quizParticipant.findMany({
    where: { sessionId: session.id },
    select: { displayName: true, totalScore: true },
  });
  const byName = Object.fromEntries(scores.map((s) => [s.displayName, s.totalScore]));
  check("wrong answer scores nothing", byName.Wrong === 0, String(byName.Wrong));
  check("faster correct answer scores higher", byName.Fast! > byName.Slow!, `${byName.Fast} vs ${byName.Slow}`);
  check("slower correct answer still scores", byName.Slow! > 0, String(byName.Slow));

  // ── Reveal ─────────────────────────────────────────────────────────────────
  const reveal = await revealAnswer(session.id);
  check("reveal gives the correct answer", reveal.correctAnswer === "right");
  check("tally counts every option, including unchosen ones", Object.keys(reveal.tally).length === 2, JSON.stringify(reveal.tally));
  check("tally is accurate", reveal.tally.right === 2 && reveal.tally.wrong === 1, JSON.stringify(reveal.tally));
  check("leaderboard is ranked", reveal.leaderboard[0]!.displayName === "Fast", reveal.leaderboard[0]!.displayName);

  await refuses("cannot answer after the reveal", () =>
    submitAnswer(session.id, fast.participant.id, q1!.questionId, "right")
  );

  // ── Question 2, then the end ───────────────────────────────────────────────
  const second = await nextQuestion(session.id);
  const q2 = "question" in second ? second.question : null;
  check("next opens question 2", q2?.index === 1, `index ${q2?.index}`);

  await submitAnswer(session.id, slow.participant.id, q2!.questionId, "yes");

  // Two questions in, asking for a third must end the quiz rather than error.
  const third = await nextQuestion(session.id);
  check("running out of questions ends the quiz", "result" in third && Boolean(third.result));

  const finished = await sessionState(session.id);
  check("session is ENDED", finished.phase === "ENDED", finished.phase);
  check("join code released for reuse", finished.joinCode === null, String(finished.joinCode));

  const result = await prisma.quizResult.findUnique({ where: { sessionId: session.id } });
  check("immutable result snapshot written", Boolean(result));
  check("snapshot records the org", result?.organizationId === SYSTEM_ORG_ID);
  check("snapshot preserves the code that was used", /^\d{6}$/.test(String(result?.joinCode)));

  const ranked = await prisma.quizParticipant.findMany({
    where: { sessionId: session.id },
    select: { displayName: true, rank: true },
    orderBy: { rank: "asc" },
  });
  // Ranks are persisted so a certificate printed months later agrees with the
  // screen on the day.
  check("ranks persisted onto participants", ranked.every((r) => r.rank !== null));
  check("winner ranked first", ranked[0]!.rank === 1);

  await refuses("cannot start an ended quiz", () => startSession(session.id));
  await refuses("cannot join an ended quiz", () =>
    joinSession(session.id, { kind: "guest", displayName: "Latecomer" })
  );

  // Ending twice must be harmless — the host may tap it again.
  const again = await endSession(session.id);
  check("ending twice is harmless", Boolean(again.result));

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL QUIZ ENGINE CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.competition.deleteMany({ where: { title: TITLE } });
  await prisma.user.deleteMany({ where: { id: HOST_ID } });
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
