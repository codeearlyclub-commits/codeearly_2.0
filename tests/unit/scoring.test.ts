/**
 * Quiz scoring. Tested hard because a scoreboard a child thinks is unfair is
 * worse than no scoreboard, and they WILL check.
 */
import { describe, it, expect } from "vitest";

import {
  scoreAnswer,
  rankLeaderboard,
  deadlineFor,
  isExpired,
  BASE_POINTS,
  MAX_SPEED_BONUS,
} from "@/server/quiz/scoring";

describe("scoreAnswer", () => {
  it("gives nothing for a wrong answer, never a negative", () => {
    expect(scoreAnswer({ correct: false, elapsedMs: 0, limitMs: 30_000 })).toBe(0);
    // Negative marking teaches children not to guess, and makes a leaderboard
    // that can go backwards — which reads as punishment.
    expect(scoreAnswer({ correct: false, elapsedMs: 30_000, limitMs: 30_000 })).toBe(0);
  });

  it("gives the full speed bonus for an instant answer", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: 30_000 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS
    );
  });

  it("gives base points with no bonus at the buzzer", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 30_000, limitMs: 30_000 })).toBe(BASE_POINTS);
  });

  it("gives half the bonus at the halfway point", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 15_000, limitMs: 30_000 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS / 2
    );
  });

  it("scales the bonus to the question's own limit, not a fixed number of seconds", () => {
    // Same proportion of thinking time used, so the same score — a 10s question
    // and a 60s question are judged on the same curve.
    const short = scoreAnswer({ correct: true, elapsedMs: 5_000, limitMs: 10_000 });
    const long = scoreAnswer({ correct: true, elapsedMs: 30_000, limitMs: 60_000 });
    expect(short).toBe(long);
  });

  it("never pays more than the maximum, even with a negative elapsed time", () => {
    // Clock skew or a replayed packet must not mint points.
    expect(scoreAnswer({ correct: true, elapsedMs: -5_000, limitMs: 30_000 })).toBe(
      BASE_POINTS + MAX_SPEED_BONUS
    );
  });

  it("still awards base points for a late arrival", () => {
    // Being right is worth something even if the packet was slow.
    expect(scoreAnswer({ correct: true, elapsedMs: 999_999, limitMs: 30_000 })).toBe(BASE_POINTS);
  });

  it("does not divide by zero on a zero limit", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: 0 })).toBe(BASE_POINTS);
  });

  it("is always an integer — no fractional points on a scoreboard", () => {
    for (const elapsed of [1, 333, 7_777, 12_345]) {
      const score = scoreAnswer({ correct: true, elapsedMs: elapsed, limitMs: 30_000 });
      expect(Number.isInteger(score)).toBe(true);
    }
  });
});

describe("rankLeaderboard", () => {
  it("orders by score, highest first", () => {
    const ranked = rankLeaderboard([
      { participantId: "a", displayName: "Ada", score: 100 },
      { participantId: "b", displayName: "Bola", score: 300 },
      { participantId: "c", displayName: "Chidi", score: 200 },
    ]);
    expect(ranked.map((r) => r.displayName)).toEqual(["Bola", "Chidi", "Ada"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("shares a rank on a tie and skips the next one", () => {
    // Two children on the same score are both 2nd, and the next is 4th — the
    // version a child will argue about if we get it wrong.
    const ranked = rankLeaderboard([
      { participantId: "a", displayName: "Ada", score: 300 },
      { participantId: "b", displayName: "Bola", score: 200 },
      { participantId: "c", displayName: "Chidi", score: 200 },
      { participantId: "d", displayName: "Dayo", score: 100 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("breaks ties alphabetically so the order does not jitter between renders", () => {
    const ranked = rankLeaderboard([
      { participantId: "z", displayName: "Zainab", score: 100 },
      { participantId: "a", displayName: "Ada", score: 100 },
    ]);
    expect(ranked.map((r) => r.displayName)).toEqual(["Ada", "Zainab"]);
    expect(ranked.every((r) => r.rank === 1)).toBe(true);
  });

  it("handles everyone on zero", () => {
    const ranked = rankLeaderboard([
      { participantId: "a", displayName: "Ada", score: 0 },
      { participantId: "b", displayName: "Bola", score: 0 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("returns an empty leaderboard for an empty room", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [
      { participantId: "a", displayName: "Ada", score: 100 },
      { participantId: "b", displayName: "Bola", score: 300 },
    ];
    const copy = JSON.parse(JSON.stringify(input));
    rankLeaderboard(input);
    expect(input).toEqual(copy);
  });
});

describe("deadlines", () => {
  const startedAt = new Date("2026-07-30T12:00:00.000Z");

  it("is an absolute instant, not a duration", () => {
    // Absolute deadlines are what let a reconnecting client land on the correct
    // remaining time instead of restarting its clock.
    expect(deadlineFor(startedAt, 30)).toBe(startedAt.getTime() + 30_000);
  });

  it("is not expired before the deadline", () => {
    expect(isExpired(startedAt, 30, startedAt.getTime() + 29_999)).toBe(false);
  });

  it("is not expired exactly on the deadline", () => {
    // The buzzer is inclusive: an answer landing on the final millisecond counts.
    expect(isExpired(startedAt, 30, startedAt.getTime() + 30_000)).toBe(false);
  });

  it("is expired one millisecond after", () => {
    expect(isExpired(startedAt, 30, startedAt.getTime() + 30_001)).toBe(true);
  });
});
