"use client";

/**
 * The live host console.
 *
 * Three things drive the design:
 *
 *  1. **The room is watching this screen.** The join code and the leaderboard are
 *     large enough to read from the back, and the correct answer is never on
 *     screen while a question is open.
 *  2. **One action at a time.** Only the button that makes sense in the current
 *     phase is shown. A host under pressure in front of thirty children should
 *     not have to choose between five buttons.
 *  3. **Nothing is computed locally.** Phase, scores and the countdown all come
 *     from the server, so this screen and every child's tablet agree.
 */
import { useState } from "react";

import { useQuiz, useCountdown } from "@/lib/quiz-socket";

type Props = {
  competitionId: string;
  title: string;
  visibility: "MEMBERS" | "UNLISTED" | "PUBLIC";
  questionCount: number;
  existing: { id: string; joinCode: string | null; phase: string } | null;
};

export function HostConsole({
  competitionId,
  title,
  visibility,
  questionCount,
  existing,
}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(existing?.id ?? null);
  const [joinCode, setJoinCode] = useState<string | null>(existing?.joinCode ?? null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quiz = useQuiz({ sessionId: sessionId ?? "", asHost: true });
  const remaining = useCountdown(quiz.question?.deadlineAt ?? null);

  async function openRoom() {
    setError(null);
    setOpening(true);
    const res = await fetch(`/api/admin/competitions/${competitionId}/session`, {
      method: "POST",
    });
    const body = await res.json().catch(() => null);
    setOpening(false);

    if (!res.ok) {
      setError(body?.error?.message ?? "Could not open the room.");
      return;
    }
    setSessionId(body.sessionId);
    setJoinCode(body.joinCode);
  }

  if (!sessionId) {
    return (
      <main className="host">
        <h1>{title}</h1>
        <p className="host__meta">
          {questionCount} question{questionCount === 1 ? "" : "s"} ·{" "}
          {visibility === "MEMBERS"
            ? "members sign in with their own code"
            : "players join with a room code"}
        </p>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="button" className="btn btn--primary btn--lg" onClick={openRoom} disabled={opening}>
          {opening ? "Opening…" : "Open the room"}
        </button>
      </main>
    );
  }

  const send = (event: "host:start" | "host:next" | "host:reveal" | "host:end") => () =>
    quiz.emit(event, { sessionId });

  return (
    <main className="host">
      <header className="host__bar">
        <div>
          <h1>{title}</h1>
          <p className="host__meta">
            {quiz.connected ? (
              <span className="host__live">● live</span>
            ) : (
              <span className="host__down">● reconnecting…</span>
            )}{" "}
            · {quiz.playerCount} player{quiz.playerCount === 1 ? "" : "s"} · {quiz.phase}
          </p>
        </div>

        {joinCode && quiz.phase !== "ENDED" && (
          <div className="host__code">
            <span>Join at /play with code</span>
            <b>{joinCode}</b>
          </div>
        )}
      </header>

      {quiz.problem && <p role="alert" className="error">{quiz.problem}</p>}

      {/* ── Lobby ─────────────────────────────────────────────────────────── */}
      {quiz.phase === "LOBBY" && (
        <section className="host__stage">
          <h2>Waiting for players</h2>
          <p className="muted">
            {quiz.playerCount === 0
              ? "Nobody has joined yet."
              : `${quiz.playerCount} of ${quiz.maxPlayers} seats taken.`}
          </p>
          <ul className="host__players">
            {quiz.players.map((p) => (
              <li key={p.participantId}>{p.displayName}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={send("host:start")}
            disabled={quiz.playerCount === 0}
            title={quiz.playerCount === 0 ? "Wait for at least one player" : undefined}
          >
            Start the quiz
          </button>
        </section>
      )}

      {/* ── Question open ─────────────────────────────────────────────────── */}
      {quiz.phase === "ACTIVE" && quiz.question && (
        <section className="host__stage">
          <p className="host__progress">
            Question {quiz.question.index + 1} of {quiz.question.total}
          </p>
          <h2 className="host__question">{quiz.question.text}</h2>

          <div className="host__timer" aria-live="off">
            {remaining ?? "—"}
          </div>

          <ol className="host__options">
            {quiz.question.options.map((option, i) => (
              <li key={option}>
                <span className="host__letter">{String.fromCharCode(65 + i)}</span>
                {option}
              </li>
            ))}
          </ol>

          {/* No correct answer on screen while the question is open — the room
              can see this display. */}
          <div className="host__actions">
            <button type="button" className="btn btn--primary" onClick={send("host:reveal")}>
              Reveal the answer
            </button>
            <button type="button" className="btn btn--ghost" onClick={send("host:next")}>
              Skip this question
            </button>
          </div>
        </section>
      )}

      {/* ── Revealed ──────────────────────────────────────────────────────── */}
      {quiz.phase === "REVEALED" && quiz.reveal && (
        <section className="host__stage">
          <h2>
            Answer: <span className="host__correct">{quiz.reveal.correctAnswer}</span>
          </h2>

          <ul className="host__tally">
            {Object.entries(quiz.reveal.tally).map(([option, count]) => {
              const total = Object.values(quiz.reveal!.tally).reduce((a, b) => a + b, 0);
              const pct = total === 0 ? 0 : Math.round((count / total) * 100);
              return (
                <li key={option} className={option === quiz.reveal!.correctAnswer ? "is-correct" : ""}>
                  <span>{option}</span>
                  {/* A bar plus the raw count: the bar reads instantly from the
                      back of a room, the number settles arguments. */}
                  <span className="host__bar" style={{ width: `${pct}%` }} aria-hidden />
                  <b>{count}</b>
                </li>
              );
            })}
          </ul>

          <Leaderboard players={quiz.reveal.leaderboard} />

          <div className="host__actions">
            <button type="button" className="btn btn--primary" onClick={send("host:next")}>
              Next question
            </button>
            <button type="button" className="btn btn--ghost" onClick={send("host:end")}>
              Finish now
            </button>
          </div>
        </section>
      )}

      {/* ── Ended ─────────────────────────────────────────────────────────── */}
      {quiz.phase === "ENDED" && (
        <section className="host__stage">
          <h2>Final scores</h2>
          <Leaderboard players={quiz.finalLeaderboard ?? quiz.players} />
          <p className="muted">
            Results are saved. The join code has been released for reuse.
          </p>
        </section>
      )}
    </main>
  );
}

function Leaderboard({
  players,
}: {
  players: Array<{ participantId: string; displayName: string; score: number; rank: number | null }>;
}) {
  if (players.length === 0) return <p className="muted">No scores yet.</p>;

  return (
    <ol className="host__leaderboard">
      {players.map((p) => (
        <li key={p.participantId} className={p.rank === 1 ? "is-first" : ""}>
          <span className="host__rank">{p.rank ?? "–"}</span>
          <span className="host__name">{p.displayName}</span>
          <b>{p.score.toLocaleString("en-NG")}</b>
        </li>
      ))}
    </ol>
  );
}
