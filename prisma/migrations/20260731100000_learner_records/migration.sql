-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CertificateKind" AS ENUM ('COURSE', 'PROGRAM', 'COMPETITION');

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lessonsCompleted" INTEGER NOT NULL,
    "coursesCompleted" INTEGER NOT NULL,
    "minutesLearning" INTEGER NOT NULL,
    "quizzesPlayed" INTEGER NOT NULL,
    "averageQuizScore" INTEGER,
    "comment" TEXT,
    "overallGrade" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kind" "CertificateKind" NOT NULL,
    "title" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subjectId" TEXT,
    "serial" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportCard_childId_status_idx" ON "ReportCard"("childId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_childId_period_key" ON "ReportCard"("childId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");

-- CreateIndex
CREATE INDEX "Certificate_childId_idx" ON "Certificate"("childId");

-- CreateIndex
CREATE INDEX "Certificate_subjectId_idx" ON "Certificate"("subjectId");

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────

-- A published report must carry its publication date, and a draft must not
-- claim one. The portal shows PUBLISHED reports to parents, so a mismatch means
-- a half-written report reaching a family.
ALTER TABLE "ReportCard" ADD CONSTRAINT "reportcard_published_has_timestamp"
  CHECK (
    ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL)
    OR ("status" <> 'PUBLISHED' AND "publishedAt" IS NULL)
  );

-- A reporting period that ends before it starts is a typo that would print on
-- a document a parent keeps.
ALTER TABLE "ReportCard" ADD CONSTRAINT "reportcard_period_ordered"
  CHECK ("periodEnd" >= "periodStart");

-- Frozen figures must be plausible: negatives are impossible, and a percentage
-- outside 0-100 means the average was computed wrongly.
ALTER TABLE "ReportCard" ADD CONSTRAINT "reportcard_counts_non_negative"
  CHECK ("lessonsCompleted" >= 0 AND "coursesCompleted" >= 0 AND "minutesLearning" >= 0 AND "quizzesPlayed" >= 0);
ALTER TABLE "ReportCard" ADD CONSTRAINT "reportcard_score_is_a_percentage"
  CHECK ("averageQuizScore" IS NULL OR ("averageQuizScore" >= 0 AND "averageQuizScore" <= 100));

-- A revocation must say why. "Revoked" with no reason is unanswerable when a
-- parent asks, and this is a document someone may have framed.
ALTER TABLE "Certificate" ADD CONSTRAINT "certificate_revocation_has_reason"
  CHECK (
    ("revokedAt" IS NULL AND "revokedReason" IS NULL)
    OR ("revokedAt" IS NOT NULL AND "revokedReason" IS NOT NULL)
  );