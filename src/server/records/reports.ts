/**
 * Report cards and certificates.
 *
 * Both are documents a parent keeps, prints, and may hand to a school. That makes
 * them unlike anything else here: once issued, what they say must not change
 * because the underlying data moved on. So both FREEZE their figures at issue
 * time rather than recomputing on render.
 *
 * The alternative — live figures — sounds better until a parent opens last term's
 * report and sees this term's numbers, or a certificate for a course renamed
 * since claims something the child never took.
 */
import type { CertificateKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { generateMembershipId } from "@/lib/ids";

// ── Report cards ─────────────────────────────────────────────────────────────

/**
 * Compute what a report card WOULD say for a period, without saving it.
 *
 * Used to pre-fill the admin form, so staff edit real figures rather than typing
 * them from memory.
 */
export async function computeReportFigures(
  childId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const [completions, courses, time, quizzes] = await Promise.all([
    prisma.lessonProgress.count({
      where: { childId, status: "COMPLETED", completedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.courseCompletion.count({
      where: { childId, completedAt: { gte: periodStart, lte: periodEnd } },
    }),
    // Engaged time is cumulative per lesson rather than dated, so this is time on
    // lessons TOUCHED in the period. Stated plainly rather than implied precision.
    prisma.lessonProgress.aggregate({
      where: { childId, lastAccessAt: { gte: periodStart, lte: periodEnd } },
      _sum: { timeSpentSeconds: true },
    }),
    prisma.quizParticipant.findMany({
      where: { childId, session: { endedAt: { gte: periodStart, lte: periodEnd } } },
      select: { totalScore: true, session: { select: { competitionId: true } } },
    }),
  ]);

  // Quiz scores are absolute points, not percentages, so an "average score" would
  // be meaningless across quizzes of different lengths. Left null unless there is
  // something defensible to say.
  const averageQuizScore = null;

  return {
    lessonsCompleted: completions,
    coursesCompleted: courses,
    minutesLearning: Math.round((time._sum.timeSpentSeconds ?? 0) / 60),
    quizzesPlayed: quizzes.length,
    averageQuizScore,
  };
}

export type ReportInput = {
  childId: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  comment?: string | null;
  overallGrade?: string | null;
  publish: boolean;
};

/**
 * Create or update a report card for a child and period.
 *
 * Figures are recomputed on every save WHILE IT IS A DRAFT, so staff writing a
 * report see current numbers. Once published they are frozen — a published report
 * is a statement that was made, not a live query.
 */
export async function saveReportCard(input: ReportInput) {
  if (input.periodEnd < input.periodStart) {
    throw errors.validation("The period end cannot be before the period start.");
  }
  if (!input.period.trim()) throw errors.validation("Give the period a name, e.g. 'Term 2, 2026'.");

  const child = await prisma.child.findUnique({
    where: { id: input.childId },
    select: { id: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  const existing = await prisma.reportCard.findUnique({
    where: { childId_period: { childId: input.childId, period: input.period.trim() } },
  });

  if (existing?.status === "PUBLISHED") {
    // Editing a published report would change a document a parent may already
    // have printed. Corrections go out as a new period, or it is unpublished
    // first — deliberately a decision, not an accident.
    throw errors.conflict(
      "This report has been published. Unpublish it first if it genuinely needs correcting."
    );
  }

  const figures = await computeReportFigures(input.childId, input.periodStart, input.periodEnd);

  const data = {
    childId: input.childId,
    period: input.period.trim(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    ...figures,
    comment: input.comment?.trim() || null,
    overallGrade: input.overallGrade?.trim() || null,
    status: input.publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
    // The database requires these to agree.
    publishedAt: input.publish ? new Date() : null,
  };

  const report = existing
    ? await prisma.reportCard.update({ where: { id: existing.id }, data })
    : await prisma.reportCard.create({ data });

  logger.info(
    { childId: input.childId, period: report.period, status: report.status },
    "report card saved"
  );
  return report;
}

/** Take a published report back to draft, so it can be corrected. */
export async function unpublishReportCard(id: string) {
  return prisma.reportCard.update({
    where: { id },
    data: { status: "DRAFT", publishedAt: null },
  });
}

/** Reports a parent may see: published only, newest first. */
export async function listReportsForParent(parentId: string) {
  return prisma.reportCard.findMany({
    where: { status: "PUBLISHED", child: { parentId } },
    orderBy: { periodEnd: "desc" },
    include: { child: { select: { id: true, childName: true, membershipId: true } } },
  });
}

// ── Certificates ─────────────────────────────────────────────────────────────

/**
 * Serial printed on the document, e.g. CE-CERT-K7QX.
 *
 * Reuses the readable-ID alphabet: a school reading this off paper and typing it
 * into the verify page should not have to distinguish O from 0.
 */
function certificateSerial(): string {
  return `CE-CERT-${generateMembershipId().split("-").pop()}`;
}

/**
 * Issue a certificate.
 *
 * Idempotent per (child, kind, subject): re-running a batch, or a parent clicking
 * twice, must not mint a second certificate for the same achievement — two
 * serials for one course is exactly the sort of thing a school queries.
 */
export async function issueCertificate(input: {
  childId: string;
  kind: CertificateKind;
  title: string;
  subjectId?: string | null;
}) {
  const child = await prisma.child.findUnique({
    where: { id: input.childId },
    select: { id: true, childName: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  if (input.subjectId) {
    const existing = await prisma.certificate.findFirst({
      where: { childId: input.childId, kind: input.kind, subjectId: input.subjectId },
    });
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const certificate = await prisma.certificate.create({
        data: {
          childId: input.childId,
          kind: input.kind,
          title: input.title.trim(),
          // Frozen: the child's name as printed. Renaming the profile later must
          // not change what the framed document says.
          recipientName: child.childName,
          subjectId: input.subjectId ?? null,
          serial: certificateSerial(),
        },
      });
      logger.info({ childId: child.id, serial: certificate.serial }, "certificate issued");
      return certificate;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") continue;
      throw err;
    }
  }
  throw errors.internal("Could not allocate a certificate serial.");
}

/**
 * Issue certificates for every completed course a child has not yet been
 * certified for. Safe to re-run.
 */
export async function issueOutstandingCertificates(childId: string) {
  const completions = await prisma.courseCompletion.findMany({
    where: { childId },
    include: { course: { select: { id: true, title: true } } },
  });

  const issued = [];
  for (const completion of completions) {
    const certificate = await issueCertificate({
      childId,
      kind: "COURSE",
      title: completion.course.title,
      subjectId: completion.courseId,
    });
    issued.push(certificate);
  }
  return issued;
}

/**
 * Look up a certificate by serial, for public verification.
 *
 * Returns a revoked certificate too — and says so. Hiding it would make a
 * withdrawn certificate indistinguishable from a forged one, which is the
 * opposite of what verification is for.
 */
export async function verifyCertificate(serial: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { serial: serial.trim().toUpperCase() },
    select: {
      serial: true,
      title: true,
      recipientName: true,
      kind: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      // The membership ID is on the printed document, so showing it lets a
      // verifier match the paper in front of them. Nothing else about the child
      // is exposed — no parent, no email, no other courses.
      child: { select: { membershipId: true } },
    },
  });
  return certificate;
}

export async function listCertificatesForParent(parentId: string) {
  return prisma.certificate.findMany({
    where: { child: { parentId } },
    orderBy: { issuedAt: "desc" },
    include: { child: { select: { id: true, childName: true } } },
  });
}

/** Withdraw a certificate. Never deletes it — a revoked serial must still verify. */
export async function revokeCertificate(id: string, reason: string) {
  if (!reason.trim()) {
    throw errors.validation("Give a reason — a revoked certificate with no reason is unanswerable.");
  }
  return prisma.certificate.update({
    where: { id },
    data: { revokedAt: new Date(), revokedReason: reason.trim() },
  });
}
