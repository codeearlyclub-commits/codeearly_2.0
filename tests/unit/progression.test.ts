/**
 * Streaks.
 *
 * The fiddly part of the child's dashboard, and the part most likely to be
 * quietly wrong: a streak that resets at the wrong moment is a promise broken to
 * a nine-year-old who did the work.
 */
import { describe, it, expect } from "vitest";

import { streakFrom } from "@/server/lms/progression";

const NOW = new Date("2026-08-04T09:00:00Z");

/** `days` ago, at a time of day that is deliberately not midnight. */
function daysAgo(n: number, hour = 14): Date {
  return new Date(NOW.getTime() - n * 86_400_000 + (hour - 9) * 3_600_000);
}

describe("streakFrom", () => {
  it("is zero with no activity", () => {
    expect(streakFrom([], NOW)).toEqual({ current: 0, best: 0 });
  });

  it("counts a single day today", () => {
    expect(streakFrom([daysAgo(0)], NOW).current).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(streakFrom(dates, NOW).current).toBe(3);
  });

  it("several sessions in one day still count as one day", () => {
    // Otherwise a child could inflate a streak by opening lessons repeatedly.
    const dates = [daysAgo(0, 9), daysAgo(0, 14), daysAgo(0, 19), daysAgo(1)];
    expect(streakFrom(dates, NOW).current).toBe(2);
  });

  it("survives a day that has not finished yet", () => {
    // Learned yesterday, nothing today, and it is only 9am. Killing the streak
    // here would punish a child who simply has not sat down yet.
    const dates = [daysAgo(1), daysAgo(2), daysAgo(3)];
    expect(streakFrom(dates, NOW).current).toBe(3);
  });

  it("breaks once two clear days have passed", () => {
    const dates = [daysAgo(2), daysAgo(3), daysAgo(4)];
    expect(streakFrom(dates, NOW).current).toBe(0);
  });

  it("a gap in the middle ends the current run at the gap", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(4), daysAgo(5)];
    expect(streakFrom(dates, NOW).current).toBe(2);
  });

  it("remembers the best run even after it lapses", () => {
    // Five days in a row a fortnight ago, one day today.
    const dates = [
      daysAgo(0),
      daysAgo(14),
      daysAgo(15),
      daysAgo(16),
      daysAgo(17),
      daysAgo(18),
    ];
    const result = streakFrom(dates, NOW);
    expect(result.current).toBe(1);
    expect(result.best).toBe(5);
  });

  it("best is never smaller than current", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3)];
    const result = streakFrom(dates, NOW);
    expect(result.best).toBeGreaterThanOrEqual(result.current);
  });

  it("unsorted input gives the same answer", () => {
    // The query orders these, but the function must not depend on that.
    const dates = [daysAgo(2), daysAgo(0), daysAgo(1)];
    expect(streakFrom(dates, NOW).current).toBe(3);
  });
});
