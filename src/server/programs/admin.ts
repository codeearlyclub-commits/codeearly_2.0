/**
 * Admin program management.
 *
 * The delicate operation here is changing capacity. `seatsTaken` is maintained
 * by an atomic counter and backed by a CHECK constraint
 * (`program_seats_within_capacity`), so lowering capacity below the number of
 * children already registered would be rejected by the database — correctly,
 * but as an opaque error. It is caught here instead and explained, because the
 * admin needs to know that four families are already booked, not that a
 * constraint failed.
 */
import type { Program, PublishStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";

export type ProgramSessionInput = {
  title: string;
  date: string; // ISO date from the form
  virtualLink?: string | null;
};

export type ProgramInput = {
  title: string;
  type: string;
  description?: string | null;
  ageRange?: string | null;
  location?: string | null;
  status: PublishStatus;
  featuredOnHomepage: boolean;
  priceKobo: number;
  regularPriceKobo?: number | null;
  capacity?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  sessions: ProgramSessionInput[];
};

export async function listAllPrograms() {
  return prisma.program.findMany({
    orderBy: [{ status: "asc" }, { startDate: "asc" }],
    include: {
      sessions: { orderBy: { date: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function getProgramForAdmin(id: string) {
  const program = await prisma.program.findUnique({
    where: { id },
    include: { sessions: { orderBy: { date: "asc" } } },
  });
  if (!program) throw errors.notFound("Program not found.");
  return program;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw errors.validation("That date isn't valid.");
  return date;
}

function validate(input: ProgramInput) {
  if (input.title.trim().length < 3) {
    throw errors.validation("A program needs a title of at least 3 characters.");
  }
  if (!Number.isSafeInteger(input.priceKobo) || input.priceKobo < 0) {
    throw errors.validation("Price must be a whole number of kobo, zero or more.");
  }
  if (input.capacity !== null && input.capacity !== undefined && input.capacity < 1) {
    throw errors.validation("Capacity must be at least 1, or left empty for unlimited.");
  }

  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (start && end && end < start) {
    throw errors.validation("The end date cannot be before the start date.");
  }

  // A deadline after the start means registration is open for a program that
  // has already begun — almost always a typo, and it silently oversells.
  const deadline = parseDate(input.registrationDeadline);
  if (start && deadline && deadline > start) {
    throw errors.validation("The registration deadline must be on or before the start date.");
  }

  if (
    input.regularPriceKobo !== null &&
    input.regularPriceKobo !== undefined &&
    input.regularPriceKobo < input.priceKobo
  ) {
    throw errors.validation(
      "The regular price should be higher than the current price — otherwise it is not a discount."
    );
  }
}

function toData(input: ProgramInput) {
  return {
    title: input.title.trim(),
    type: input.type.trim() || "Holiday",
    description: input.description?.trim() || null,
    ageRange: input.ageRange?.trim() || null,
    location: input.location?.trim() || null,
    status: input.status,
    featuredOnHomepage: input.featuredOnHomepage,
    priceKobo: input.priceKobo,
    regularPriceKobo: input.regularPriceKobo ?? null,
    capacity: input.capacity ?? null,
    startDate: parseDate(input.startDate),
    endDate: parseDate(input.endDate),
    registrationDeadline: parseDate(input.registrationDeadline),
  };
}

export async function createProgram(input: ProgramInput): Promise<Program> {
  validate(input);

  return prisma.$transaction(async (tx) => {
    const program = await tx.program.create({ data: toData(input) });
    if (input.sessions.length > 0) {
      await tx.programSession.createMany({
        data: input.sessions.map((s) => ({
          programId: program.id,
          title: s.title.trim(),
          date: new Date(s.date),
          virtualLink: s.virtualLink?.trim() || null,
        })),
      });
    }
    return program;
  });
}

export async function updateProgram(id: string, input: ProgramInput): Promise<Program> {
  validate(input);

  const existing = await prisma.program.findUnique({
    where: { id },
    select: { seatsTaken: true },
  });
  if (!existing) throw errors.notFound("Program not found.");

  // The database would reject this too, but with an error nobody can act on.
  if (
    input.capacity !== null &&
    input.capacity !== undefined &&
    input.capacity < existing.seatsTaken
  ) {
    throw errors.conflict(
      `${existing.seatsTaken} ${existing.seatsTaken === 1 ? "child is" : "children are"} already registered, so capacity cannot be set below ${existing.seatsTaken}.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const program = await tx.program.update({ where: { id }, data: toData(input) });

    // Sessions are replaced wholesale rather than diffed. A schedule is read as
    // a single thing, and a half-applied edit is worse than a rewritten one.
    await tx.programSession.deleteMany({ where: { programId: id } });
    if (input.sessions.length > 0) {
      await tx.programSession.createMany({
        data: input.sessions.map((s) => ({
          programId: id,
          title: s.title.trim(),
          date: new Date(s.date),
          virtualLink: s.virtualLink?.trim() || null,
        })),
      });
    }

    return program;
  });
}

/**
 * Archive when anyone is registered; delete only when nobody is.
 *
 * Same reasoning as courses: deleting cascades the registrations away, which
 * erases the record that a family paid for and attended a program.
 */
export async function removeProgram(id: string): Promise<{ archived: boolean }> {
  const registered = await prisma.programEnrollment.count({
    where: { programId: id, status: "active" },
  });

  if (registered > 0) {
    await prisma.program.update({ where: { id }, data: { status: "ARCHIVED" } });
    return { archived: true };
  }

  await prisma.program.delete({ where: { id } });
  return { archived: false };
}
