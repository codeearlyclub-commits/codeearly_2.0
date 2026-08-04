/**
 * The parent portal dashboard, in one call.
 *
 * WHY THIS EXISTS AS A SERVICE RATHER THAN QUERIES IN THE PAGE
 *
 * The dashboard answers four questions at once — how are my children doing, do I
 * owe anything, what is next, is anything waiting on me. Assembled ad hoc in the
 * page that becomes a dozen round trips that grow every time the design changes,
 * and the N+1 hides behind a nice-looking component.
 *
 * So the per-child figures are fetched as a handful of grouped aggregates across
 * ALL the children at once, then stitched in memory. A parent with six children
 * costs the same number of queries as a parent with one.
 *
 * Everything here is scoped by `parentId` at the query level. There is no path
 * that loads a child and compares ownership afterwards.
 */
import { prisma } from "@/lib/prisma";

export type ChildOverview = {
  id: string;
  name: string;
  membershipId: string;
  loginEnabled: boolean;
  /** Courses the child is enrolled on. */
  coursesEnrolled: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  minutesLearning: number;
  certificates: number;
  /** Published reports only — a draft is not a parent's business yet. */
  reports: number;
  lastActiveAt: Date | null;
  /** The single most useful thing to show: what they are part-way through. */
  current: { title: string; slug: string; percent: number } | null;
};

export type PortalOverview = {
  children: ChildOverview[];
  money: {
    unpaidCount: number;
    unpaidKobo: number;
    /** The oldest unpaid invoice — the one to chase first. */
    oldestUnpaid: { invoiceNumber: string; amountKobo: number; createdAt: Date } | null;
    subscriptionEndsAt: Date | null;
    subscriptionActive: boolean;
  };
  /** Upcoming program sessions across every child, soonest first. */
  upcoming: Array<{
    id: string;
    title: string;
    programTitle: string;
    date: Date;
    virtualLink: string | null;
    childName: string;
  }>;
};

export async function getPortalOverview(parentId: string): Promise<PortalOverview> {
  const children = await prisma.child.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      childName: true,
      membershipId: true,
      loginEnabled: true,
    },
  });

  const childIds = children.map((c) => c.id);

  // A parent with no children still gets a well-formed dashboard rather than a
  // set of queries against an empty IN () clause.
  if (childIds.length === 0) {
    const money = await moneyFor(parentId);
    return { children: [], money, upcoming: [] };
  }

  const [
    enrolments,
    completions,
    lessonsDone,
    timeAndLast,
    certificates,
    reports,
    inProgress,
    money,
    sessions,
  ] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds } },
      _count: { _all: true },
    }),
    prisma.courseCompletion.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds } },
      _count: { _all: true },
    }),
    prisma.lessonProgress.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds }, status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.lessonProgress.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds } },
      _sum: { timeSpentSeconds: true },
      _max: { lastAccessAt: true },
    }),
    prisma.certificate.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds }, revokedAt: null },
      _count: { _all: true },
    }),
    prisma.reportCard.groupBy({
      by: ["childId"],
      where: { childId: { in: childIds }, status: "PUBLISHED" },
      _count: { _all: true },
    }),
    currentCourses(childIds),
    moneyFor(parentId),
    upcomingSessions(childIds),
  ]);

  const byChild = <T extends { childId: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.childId, r]));

  const enrolMap = byChild(enrolments);
  const completeMap = byChild(completions);
  const lessonMap = byChild(lessonsDone);
  const timeMap = byChild(timeAndLast);
  const certMap = byChild(certificates);
  const reportMap = byChild(reports);

  const childNames = new Map(children.map((c) => [c.id, c.childName]));

  return {
    children: children.map((child) => ({
      id: child.id,
      name: child.childName,
      membershipId: child.membershipId,
      loginEnabled: child.loginEnabled,
      coursesEnrolled: enrolMap.get(child.id)?._count._all ?? 0,
      coursesCompleted: completeMap.get(child.id)?._count._all ?? 0,
      lessonsCompleted: lessonMap.get(child.id)?._count._all ?? 0,
      minutesLearning: Math.round((timeMap.get(child.id)?._sum.timeSpentSeconds ?? 0) / 60),
      certificates: certMap.get(child.id)?._count._all ?? 0,
      reports: reportMap.get(child.id)?._count._all ?? 0,
      lastActiveAt: timeMap.get(child.id)?._max.lastAccessAt ?? null,
      current: inProgress.get(child.id) ?? null,
    })),
    money,
    upcoming: sessions.map((s) => ({
      ...s,
      childName: childNames.get(s.childId) ?? "",
    })),
  };
}

/**
 * The course each child is furthest into but has not finished.
 *
 * Deliberately one query for all children rather than one per child. Percentages
 * are computed against PUBLISHED lessons only, to match what the child can
 * actually see — counting drafts would show a child stuck at 80% forever.
 */
async function currentCourses(childIds: string[]) {
  const progress = await prisma.lessonProgress.findMany({
    where: { childId: { in: childIds } },
    select: {
      childId: true,
      status: true,
      lesson: {
        select: {
          courseId: true,
          course: { select: { title: true, slug: true } },
        },
      },
    },
  });

  const publishedCounts = await prisma.lesson.groupBy({
    by: ["courseId"],
    where: { published: true },
    _count: { _all: true },
  });
  const totals = new Map(publishedCounts.map((r) => [r.courseId, r._count._all]));

  // childId → courseId → completed count
  const done = new Map<string, Map<string, { completed: number; title: string; slug: string }>>();
  for (const row of progress) {
    const courseId = row.lesson.courseId;
    const forChild = done.get(row.childId) ?? new Map();
    const entry =
      forChild.get(courseId) ??
      { completed: 0, title: row.lesson.course.title, slug: row.lesson.course.slug };
    if (row.status === "COMPLETED") entry.completed += 1;
    forChild.set(courseId, entry);
    done.set(row.childId, forChild);
  }

  const result = new Map<string, { title: string; slug: string; percent: number }>();
  for (const [childId, courses] of done) {
    let best: { title: string; slug: string; percent: number } | null = null;
    for (const [courseId, entry] of courses) {
      const total = totals.get(courseId) ?? 0;
      if (total === 0) continue;
      const percent = Math.round((entry.completed / total) * 100);
      // Started but not finished. A completed course belongs in the achievement
      // count, not in "what they are working on".
      if (percent === 0 || percent >= 100) continue;
      if (!best || percent > best.percent) {
        best = { title: entry.title, slug: entry.slug, percent };
      }
    }
    if (best) result.set(childId, best);
  }
  return result;
}

async function moneyFor(parentId: string): Promise<PortalOverview["money"]> {
  const [unpaid, oldest, subscription] = await Promise.all([
    prisma.invoice.aggregate({
      where: { parentId, status: "PENDING" },
      _count: { _all: true },
      _sum: { amountKobo: true },
    }),
    prisma.invoice.findFirst({
      where: { parentId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { invoiceNumber: true, amountKobo: true, createdAt: true },
    }),
    prisma.subscription.findFirst({
      where: { parentId, status: "active" },
      orderBy: { endDate: "desc" },
      select: { endDate: true },
    }),
  ]);

  return {
    unpaidCount: unpaid._count._all,
    unpaidKobo: unpaid._sum.amountKobo ?? 0,
    oldestUnpaid: oldest,
    subscriptionEndsAt: subscription?.endDate ?? null,
    // Read from the row rather than inferred from the date: a subscription can be
    // ACTIVE with a period end in the past for the moments before the expiry job
    // runs, and telling a parent they have lapsed when we have not yet acted on
    // it would be wrong.
    subscriptionActive: subscription !== null,
  };
}

/** The next few program sessions, across every child. */
async function upcomingSessions(childIds: string[]) {
  const enrolments = await prisma.programEnrollment.findMany({
    where: { childId: { in: childIds }, status: { not: "cancelled" } },
    select: {
      childId: true,
      program: {
        select: {
          title: true,
          sessions: {
            where: { date: { gte: new Date() } },
            orderBy: { date: "asc" },
            select: { id: true, title: true, date: true, virtualLink: true },
          },
        },
      },
    },
  });

  return enrolments
    .flatMap((e) =>
      e.program.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        programTitle: e.program.title,
        date: s.date,
        virtualLink: s.virtualLink,
        childId: e.childId,
      }))
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
}
