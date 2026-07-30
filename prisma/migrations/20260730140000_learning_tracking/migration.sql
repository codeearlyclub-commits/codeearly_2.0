-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('LESSON_STARTED', 'LESSON_COMPLETED', 'COURSE_COMPLETED', 'QUIZ_PLAYED', 'PROGRAM_ATTENDED');

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CourseCompletion" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lessonCount" INTEGER NOT NULL,

    CONSTRAINT "CourseCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningActivity" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "courseId" TEXT,
    "lessonId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseCompletion_courseId_idx" ON "CourseCompletion"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCompletion_childId_courseId_key" ON "CourseCompletion"("childId", "courseId");

-- CreateIndex
CREATE INDEX "LearningActivity_childId_createdAt_idx" ON "LearningActivity"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningActivity_courseId_idx" ON "LearningActivity"("courseId");

-- CreateIndex
CREATE INDEX "LessonProgress_childId_lastAccessAt_idx" ON "LessonProgress"("childId", "lastAccessAt");

-- AddForeignKey
ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCompletion" ADD CONSTRAINT "CourseCompletion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Engaged time cannot be negative, and a single lesson cannot legitimately
-- accumulate more than 24h — a larger figure means the accumulator is broken,
-- and it would go straight onto a report card.
ALTER TABLE "LessonProgress" ADD CONSTRAINT "lessonprogress_time_sane"
  CHECK ("timeSpentSeconds" >= 0 AND "timeSpentSeconds" <= 86400);

-- A completion that claims zero lessons is not a completion.
ALTER TABLE "CourseCompletion" ADD CONSTRAINT "coursecompletion_lessons_positive"
  CHECK ("lessonCount" > 0);