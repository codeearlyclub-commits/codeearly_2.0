/**
 * Scoring — pure functions, no database, so the rules are testable in isolation.
 *
 * The design goal is a scoreboard a child accepts as fair. That means speed has
 * to matter (otherwise everyone who knows the answer ties, and the game is
 * boring) but not dominate (otherwise the fastest tapper always wins and a
 * thoughtful child never can).
 */

/** Points for a correct answer before any speed bonus. */
export const BASE_POINTS = 1000;

/** Maximum additional points for answering instantly. */
export const MAX_SPEED_BONUS = 500;

export type ScoreInput = {
  correct: boolean;
  /** Milliseconds between the question opening and the answer arriving. */
  elapsedMs: number;
  /** The question's time limit in milliseconds. */
  limitMs: number;
};

/**
 * Points for a single answer.
 *
 * A wrong answer scores zero — never negative. Negative marking teaches
 * children not to guess, which is the opposite of what a learning quiz wants,
 * and it makes a leaderboard that can go backwards, which reads as punishment.
 *
 * The speed bonus decays linearly across the question's own time limit rather
 * than a fixed number of seconds, so a 10-second question and a 60-second
 * question are scored on the same curve in proportion to the thinking time
 * they were given.
 */
export function scoreAnswer({ correct, elapsedMs, limitMs }: ScoreInput): number {
  if (!correct) return 0;

  // A zero or negative limit is invalid data, not an instant answer. Award the
  // base score and no bonus: a misconfigured question must not hand every
  // player maximum points, which is what treating it as "answered instantly"
  // would do.
  if (limitMs <= 0) return BASE_POINTS;

  // Clamp rather than trust: a clock skew or a replayed packet must not mint
  // points, and a late arrival still earns the base score for being right.
  const limit = limitMs;
  const elapsed = Math.min(Math.max(0, elapsedMs), limit);

  const remainingFraction = 1 - elapsed / limit;
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * remainingFraction);
}

export type Standing = {
  participantId: string;
  displayName: string;
  score: number;
};

export type RankedStanding = Standing & { rank: number };

/**
 * Rank a leaderboard, sharing a rank on a tie.
 *
 * Two children on the same score are both "2nd" — and the next child is 4th,
 * not 3rd. Ordinary competition ranking, and the version a child will argue
 * about if we get it wrong. Ties break alphabetically only for display
 * stability, so the order does not jitter between renders.
 */
export function rankLeaderboard(standings: Standing[]): RankedStanding[] {
  const sorted = [...standings].sort(
    (a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName)
  );

  const ranked: RankedStanding[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;

  sorted.forEach((entry, index) => {
    const rank = entry.score === lastScore ? lastRank : index + 1;
    ranked.push({ ...entry, rank });
    lastScore = entry.score;
    lastRank = rank;
  });

  return ranked;
}

/**
 * Absolute epoch-ms deadline for a question.
 *
 * Deadlines are absolute, never durations. A client that reconnects mid-question
 * must land on the correct remaining time instead of restarting its clock — the
 * V4 countdown desync, fixed by making the server's answer unambiguous.
 */
export function deadlineFor(startedAt: Date, timeLimitSeconds: number): number {
  return startedAt.getTime() + timeLimitSeconds * 1000;
}

/** Has the window for this question closed? */
export function isExpired(startedAt: Date, timeLimitSeconds: number, now = Date.now()): boolean {
  return now > deadlineFor(startedAt, timeLimitSeconds);
}
