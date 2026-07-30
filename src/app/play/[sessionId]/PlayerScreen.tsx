"use client";

/**
 * The child's play screen.
 *
 * Written for a nine-year-old on a tablet, in a room, under time pressure:
 *
 *  - Answer buttons are the largest thing on screen and are lettered A–D as well
 *    as coloured, because colour alone excludes colour-blind children.
 *  - Once answered, the buttons lock. Tapping again cannot change or double-score
 *    an answer, and the screen says plainly that it was received — uncertainty is
 *    what makes children tap repeatedly.
 *  - The countdown is derived from the server's absolute deadline, so a tablet
 *    that sleeps and wakes shows the right time rather than its own drift.
 *  - Nothing reveals correctness until the host reveals it.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { useQuiz, useCountdown } from "@/lib/quiz-socket";

type Identity = {
  participantId: string;
  guestToken?: string;
  displayName: string;
};

/**
 * Read this device's seat from sessionStorage.
 *
 * useSyncExternalStore rather than an effect-plus-setState: sessionStorage is
 * external mutable state, and this is the API designed for reading it. It also
 * avoids a hydration mismatch, because the server snapshot is explicitly null.
 *
 * sessionStorage, not localStorage — the token is a credential for one quiz on
 * one device, and a shared classroom tablet must not hand the next child the
 * previous child's seat.
 */
function useStoredIdentity(joinCode: string): Identity | null {
  const subscribe = useCallback(() => () => {}, []);
  const getSnapshot = useCallback(
    () => (joinCode ? sessionStorage.getItem(`ce-quiz-${joinCode}`) : null),
    [joinCode]
  );
  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Identity;
    } catch {
      return null;
    }
  }, [raw]);
}

export function PlayerScreen({ sessionId, joinCode }: { sessionId: string; joinCode: string }) {
  const identity = useStoredIdentity(joinCode);

  // Stored WITH its question id rather than reset by an effect, so "have I
  // answered this one?" is derived. A stale lock from the previous question is
  // then structurally impossible.
  const [answeredFor, setAnsweredFor] = useState<{ questionId: string; option: string } | null>(
    null
  );

  const quiz = useQuiz({
    sessionId,
    participantId: identity?.participantId,
    guestToken: identity?.guestToken,
  });
  const remaining = useCountdown(quiz.question?.deadlineAt ?? null);

  const answered =
    answeredFor && answeredFor.questionId === quiz.question?.questionId
      ? answeredFor.option
      : null;

  if (!identity) {
    return (
      <main className="play">
        <h1>Join the quiz first</h1>
        <p className="play__lead">We could not find your place in this quiz on this device.</p>
        <Link href="/play" className="btn btn--primary btn--lg">
          Enter your code
        </Link>
      </main>
    );
  }

  function answer(option: string) {
    if (answered || !quiz.question) return;
    // Optimistic only about the LOCK, never about the score. Locking instantly
    // stops double-taps; the score still comes from the server.
    setAnsweredFor({ questionId: quiz.question.questionId, option });
    quiz.emit("answer:submit", {
      questionId: quiz.question.questionId,
      selectedAnswer: option,
    });
  }

  const me = quiz.players.find((p) => p.participantId === identity.participantId);

  return (
    <main className="play">
      <header className="play__bar">
        <span className="play__me">{identity.displayName}</span>
        {me && <span className="play__score">{me.score.toLocaleString("en-NG")}</span>}
        {!quiz.connected && <span className="play__reconnect">reconnecting…</span>}
      </header>

      {quiz.problem && <p role="alert" className="error">{quiz.problem}</p>}

      {quiz.phase === "LOBBY" && (
        <section className="play__stage">
          <h1>You&apos;re in!</h1>
          <p className="play__lead">
            Waiting for the quiz to start. {quiz.playerCount} player
            {quiz.playerCount === 1 ? "" : "s"} here.
          </p>
        </section>
      )}

      {quiz.phase === "ACTIVE" && quiz.question && (
        <section className="play__stage">
          <div className="play__timer">{remaining ?? "—"}</div>
          <h1 className="play__question">{quiz.question.text}</h1>

          <div className="play__options">
            {quiz.question.options.map((option, i) => (
              <button
                key={option}
                type="button"
                onClick={() => answer(option)}
                disabled={Boolean(answered)}
                className={`play__option play__option--${i} ${
                  answered === option ? "is-chosen" : ""
                }`}
              >
                <span className="play__letter">{String.fromCharCode(65 + i)}</span>
                {option}
              </button>
            ))}
          </div>

          {answered && (
            <p className="play__locked">
              Answer sent — sit tight!
              {/* Encouragement from the server, shown only to this child. */}
              {quiz.cheer && <span className="play__cheer">{quiz.cheer}</span>}
            </p>
          )}
        </section>
      )}

      {quiz.phase === "REVEALED" && quiz.reveal && (
        <section className="play__stage">
          <h1
            className={
              answered === quiz.reveal.correctAnswer ? "play__right" : "play__wrong"
            }
          >
            {answered === quiz.reveal.correctAnswer
              ? "Correct!"
              : answered
                ? "Not this time"
                : "Time's up"}
          </h1>
          <p className="play__lead">
            The answer was <b>{quiz.reveal.correctAnswer}</b>
          </p>

          <ol className="play__leaderboard">
            {quiz.reveal.leaderboard.slice(0, 5).map((p) => (
              <li
                key={p.participantId}
                className={p.participantId === identity.participantId ? "is-me" : ""}
              >
                <span>{p.rank}</span>
                <span>{p.displayName}</span>
                <b>{p.score.toLocaleString("en-NG")}</b>
              </li>
            ))}
          </ol>
        </section>
      )}

      {quiz.phase === "ENDED" && (
        <section className="play__stage">
          <h1>That&apos;s the end!</h1>
          <ol className="play__leaderboard">
            {(quiz.finalLeaderboard ?? []).map((p) => (
              <li
                key={p.participantId}
                className={p.participantId === identity.participantId ? "is-me" : ""}
              >
                <span>{p.rank}</span>
                <span>{p.displayName}</span>
                <b>{p.score.toLocaleString("en-NG")}</b>
              </li>
            ))}
          </ol>
          <p className="play__lead">Well played. You can close this now.</p>
        </section>
      )}
    </main>
  );
}
