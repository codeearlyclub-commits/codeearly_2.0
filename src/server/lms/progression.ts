/**
 * XP, levels, streaks and badges — the child's motivation layer.
 *
 * EVERYTHING HERE IS DERIVED, NOT STORED.
 *
 * There is no `xp` column and there deliberately is not one. A stored score has
 * to be kept in sync with the thing it measures, and the moment those two
 * disagree the number is a lie told to a child — the worst kind to ship. Derived
 * from `LessonProgress`, `CourseCompletion`, `Certificate` and
 * `LearningActivity`, it cannot drift, cannot be double-awarded by a retry, and
 * survives any backfill or correction staff make to the underlying records.
 *
 * The cost is a handful of counts per page load, which is cheap and bounded.
 * If it ever stops being cheap the fix is a cache, not a column.
 *
 * The other rule: nothing here is awarded for time spent or for logging in.
 * Points for minutes rewards leaving a tab open; points for streaks alone
 * punishes a child who was ill. Every point below is attached to something the
 * child actually finished.
 */
import { prisma } from "@/lib/prisma";

/** What each finished thing is worth. Round numbers, so children can do the maths. */
const POINTS = {
  lesson: 50,
  course: 250,
  certificate: 100,
  quiz: 25,
} as const;

/**
 * Level thresholds.
 *
 * Widening gaps, but the first few are close together on purpose: a child needs
 * to reach Level 2 in their first session or the whole device is meaningless to
 * them. Level 1 is where everyone starts, at zero.
 */
type LevelBand = { level: number; at: number; title: string };

const LEVELS: readonly LevelBand[] = [
  { level: 1, at: 0, title: "Newcomer" },
  { level: 2, at: 100, title: "Starter" },
  { level: 3, at: 300, title: "Builder" },
  { level: 4, at: 700, title: "Explorer" },
  { level: 5, at: 1_200, title: "Maker" },
  { level: 6, at: 2_000, title: "Coder" },
  { level: 7, at: 3_000, title: "Creator" },
  { level: 8, at: 4_500, title: "Engineer" },
  { level: 9, at: 6_500, title: "Innovator" },
  { level: 10, at: 9_000, title: "SuperKoder" },
] as const;

export type LearnerProfile = {
  xp: number;
  level: number;
  levelTitle: string;
  /** XP earned inside the current level, and what the level spans. */
  xpIntoLevel: number;
  xpForLevel: number;
  /** Null at the top level — there is nothing left to count towards. */
  xpToNext: number | null;
  percentToNext: number;
  /** Consecutive days with activity, counting back from today. */
  streakDays: number;
  /** True if today already counts, so the UI can say "keep it up" vs "don't lose it". */
  activeToday: boolean;
  bestStreakDays: number;
  counts: {
    lessons: number;
    courses: number;
    certificates: number;
    quizzes: number;
  };
  badges: Badge[];
};

export type Badge = {
  id: string;
  label: string;
  icon: string;
  /** What earns it — shown greyed out when not yet earned, so it is a goal. */
  hint: string;
  earned: boolean;
};

function levelFor(xp: number) {
  let current = LEVELS[0]!;
  for (const entry of LEVELS) if (xp >= entry.at) current = entry;
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;
  return { current, next };
}

/**
 * Consecutive days with any recorded activity, counting back from today.
 *
 * A streak that breaks the instant midnight passes is cruel and, for a child in
 * a different timezone to the server, arbitrary. So a streak stays alive if
 * there was activity today OR yesterday, and only then counts backwards.
 */
export function streakFrom(dates: Date[], now = new Date()): { current: number; best: number } {
  if (dates.length === 0) return { current: 0, best: 0 };

  const dayOf = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const days = [...new Set(dates.map(dayOf))].sort((a, b) => b - a);
  const today = dayOf(now);

  let current = 0;
  if (days[0] === today || days[0] === today - 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i - 1]! - days[i]! === 1) current++;
      else break;
    }
  }

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1]! - days[i]! === 1) run++;
    else run = 1;
    if (run > best) best = run;
  }

  return { current, best: Math.max(best, current) };
}

export async function getLearnerProfile(childId: string): Promise<LearnerProfile> {
  const [lessons, courses, certificates, quizzes, activityDates] = await Promise.all([
    prisma.lessonProgress.count({ where: { childId, status: "COMPLETED" } }),
    prisma.courseCompletion.count({ where: { childId } }),
    prisma.certificate.count({ where: { childId, revokedAt: null } }),
    prisma.quizParticipant.count({ where: { childId } }),
    prisma.learningActivity.findMany({
      where: { childId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      // A year of daily activity is far more than enough to compute a streak,
      // and bounds the query for a child who has been with us for years.
      take: 400,
    }),
  ]);

  const xp =
    lessons * POINTS.lesson +
    courses * POINTS.course +
    certificates * POINTS.certificate +
    quizzes * POINTS.quiz;

  const { current, next } = levelFor(xp);
  const xpIntoLevel = xp - current.at;
  const xpForLevel = next ? next.at - current.at : 0;

  const dates = activityDates.map((a) => a.createdAt);
  const streak = streakFrom(dates);
  const today = Math.floor(Date.now() / 86_400_000);
  const activeToday = dates.some((d) => Math.floor(d.getTime() / 86_400_000) === today);

  return {
    xp,
    level: current.level,
    levelTitle: current.title,
    xpIntoLevel,
    xpForLevel,
    xpToNext: next ? next.at - xp : null,
    percentToNext: next ? Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100)) : 100,
    streakDays: streak.current,
    activeToday,
    bestStreakDays: streak.best,
    counts: { lessons, courses, certificates, quizzes },
    badges: badgesFor({ lessons, courses, certificates, quizzes, streak: streak.best }),
  };
}

/**
 * Badges.
 *
 * Unearned badges are returned too, greyed out by the UI. A locked badge a child
 * can see is a goal; a badge that only appears once earned is a surprise they
 * never worked towards.
 */
function badgesFor(c: {
  lessons: number;
  courses: number;
  certificates: number;
  quizzes: number;
  streak: number;
}): Badge[] {
  return [
    { id: "first-lesson", label: "First steps", icon: "👣", hint: "Finish your first lesson", earned: c.lessons >= 1 },
    { id: "ten-lessons", label: "Getting good", icon: "⚡", hint: "Finish 10 lessons", earned: c.lessons >= 10 },
    { id: "fifty-lessons", label: "Unstoppable", icon: "🚀", hint: "Finish 50 lessons", earned: c.lessons >= 50 },
    { id: "first-course", label: "Course done", icon: "🎓", hint: "Finish a whole course", earned: c.courses >= 1 },
    { id: "three-courses", label: "Triple threat", icon: "🏅", hint: "Finish 3 courses", earned: c.courses >= 3 },
    { id: "certified", label: "Certified", icon: "📜", hint: "Earn a certificate", earned: c.certificates >= 1 },
    { id: "quizzer", label: "Quiz player", icon: "🎯", hint: "Play a live quiz", earned: c.quizzes >= 1 },
    { id: "quiz-regular", label: "Quiz regular", icon: "🎪", hint: "Play 5 live quizzes", earned: c.quizzes >= 5 },
    { id: "streak-3", label: "On a roll", icon: "🔥", hint: "Learn 3 days in a row", earned: c.streak >= 3 },
    { id: "streak-7", label: "Week warrior", icon: "🌟", hint: "Learn 7 days in a row", earned: c.streak >= 7 },
  ];
}
