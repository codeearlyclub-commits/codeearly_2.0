/**
 * Programs — cohort-based offerings like the holiday Bootcamp.
 *
 * The rule that governs everything here is **capacity**. A program has real
 * physical or staffing limits, and overselling one is not a database problem,
 * it is a room with more children in it than there are laptops. So capacity is
 * enforced inside a transaction with the row locked, not by a count-then-insert
 * that two simultaneous registrations can both pass.
 */
import type { Program } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Programs for the public site: published only, soonest first. */
export async function listPublicPrograms() {
  return prisma.program.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ startDate: "asc" }, { title: "asc" }],
    include: {
      sessions: { orderBy: { date: "asc" }, select: { id: true, title: true, date: true } },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function getPublicProgram(id: string) {
  const program = await prisma.program.findFirst({
    where: { id, status: "PUBLISHED" },
    include: {
      sessions: { orderBy: { date: "asc" } },
      courses: { include: { course: { select: { id: true, title: true, slug: true } } } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!program) throw errors.notFound("Program not found.");
  return program;
}

/** Seats left, or null when the program has no cap. */
export function seatsRemaining(
  program: Pick<Program, "capacity">,
  enrolled: number
): number | null {
  if (program.capacity === null) return null;
  return Math.max(0, program.capacity - enrolled);
}

/**
 * Register a child for a program.
 *
 * Capacity is checked inside the transaction after locking the program row.
 * The naive version — count, compare, insert — lets two registrations arriving
 * at the same moment both read "19 of 20 taken" and both succeed, which is how
 * you end up with 21 children booked into a room for 20.
 *
 * Idempotent on (program, child): a parent double-submitting gets their
 * existing place back rather than an error.
 */
export async function registerForProgram(
  programId: string,
  childId: string,
  parentId: string
) {
  const child = await prisma.child.findFirst({
    where: { id: childId, parentId },
    select: { id: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program || program.status !== "PUBLISHED") {
    throw errors.notFound("Program not found.");
  }
  if (program.registrationDeadline && program.registrationDeadline < new Date()) {
    throw errors.conflict("Registration for this program has closed.");
  }

  // Already registered? Return their place. Checked before claiming a seat so a
  // retry cannot consume a second one.
  const existing = await prisma.programEnrollment.findUnique({
    where: { programId_childId: { programId, childId } },
  });
  if (existing && existing.status === "active") return existing;

  // Claim a seat with a single atomic statement. Either this UPDATE matches a
  // row (a seat was available and is now ours) or it matches none (full).
  //
  // This replaces a SELECT ... FOR UPDATE inside an interactive transaction,
  // which was correct but queued every concurrent registration behind a lock —
  // and under real contention the waiters blew Prisma's 5s transaction timeout
  // and failed, which is exactly the moment overselling protection has to work.
  // Here contention lasts for one statement.
  const claimed = await prisma.program.updateMany({
    where: {
      id: programId,
      OR: [{ capacity: null }, { seatsTaken: { lt: program.capacity ?? 0 } }],
    },
    data: { seatsTaken: { increment: 1 } },
  });
  if (claimed.count === 0) {
    throw errors.conflict("This program is fully booked.");
  }

  try {
    const enrolment = await prisma.programEnrollment.upsert({
      where: { programId_childId: { programId, childId } },
      create: { programId, childId, status: "active" },
      update: { status: "active" },
    });
    logger.info({ programId, childId }, "program registration created");
    return enrolment;
  } catch (err) {
    // Hand the seat back if the enrolment write failed, or it is leaked and the
    // program silently shrinks by one place every time this happens.
    await prisma.program.update({
      where: { id: programId },
      data: { seatsTaken: { decrement: 1 } },
    });
    throw err;
  }
}

/**
 * Withdraw a child. Marks the row rather than deleting it — the fact that a
 * child was once registered is history worth keeping, and deleting it would
 * silently free a seat with no record of why.
 */
export async function withdrawFromProgram(
  programId: string,
  childId: string,
  parentId: string
) {
  const child = await prisma.child.findFirst({
    where: { id: childId, parentId },
    select: { id: true },
  });
  if (!child) throw errors.notFound("Child not found.");

  const enrolment = await prisma.programEnrollment.findUnique({
    where: { programId_childId: { programId, childId } },
  });
  if (!enrolment) throw errors.notFound("Registration not found.");
  if (enrolment.status !== "active") return enrolment; // already withdrawn

  // Status change and seat release must happen together — a withdrawal that
  // failed to free the seat would quietly shrink the program.
  const [updated] = await prisma.$transaction([
    prisma.programEnrollment.update({
      where: { id: enrolment.id },
      data: { status: "withdrawn" },
    }),
    prisma.program.update({
      where: { id: programId },
      data: { seatsTaken: { decrement: 1 } },
    }),
  ]);
  return updated;
}

/** Programs a child is registered for. */
export async function listChildPrograms(childId: string) {
  return prisma.programEnrollment.findMany({
    where: { childId, status: "active" },
    include: {
      program: {
        select: { id: true, title: true, type: true, startDate: true, endDate: true, location: true },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}
