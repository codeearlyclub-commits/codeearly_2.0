-- Overselling protection for programs.
--
-- Replaces a SELECT ... FOR UPDATE inside an interactive transaction. That was
-- correct but queued every concurrent registration behind one row lock, and
-- under real contention the waiters exceeded Prisma's 5s transaction timeout
-- and failed — precisely when the protection needs to work. A counter claimed
-- by a single conditional UPDATE holds the lock for one statement instead.

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "seatsTaken" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing active registrations so the counter starts truthful.
UPDATE "Program" p
SET "seatsTaken" = (
  SELECT count(*) FROM "ProgramEnrollment" e
  WHERE e."programId" = p."id" AND e."status" = 'active'
);

-- The application claims seats with `WHERE seatsTaken < capacity`, but the
-- database is the backstop: no code path may exceed capacity or go negative.
ALTER TABLE "Program" ADD CONSTRAINT "program_seats_within_capacity"
  CHECK ("seatsTaken" >= 0 AND ("capacity" IS NULL OR "seatsTaken" <= "capacity"));
