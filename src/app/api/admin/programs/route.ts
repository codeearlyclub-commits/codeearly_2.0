/**
 * Admin programs: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllPrograms, createProgram } from "@/server/programs/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const programSchema = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.string().trim().max(40),
  description: z.string().trim().max(3000).optional().nullable(),
  ageRange: z.string().trim().max(20).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  featuredOnHomepage: z.boolean(),
  priceKobo: z.number().int().min(0),
  regularPriceKobo: z.number().int().min(0).optional().nullable(),
  capacity: z.number().int().min(1).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  registrationDeadline: z.string().optional().nullable(),
  sessions: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        date: z.string().min(1),
        virtualLink: z.string().trim().max(500).optional().nullable(),
      })
    )
    .max(60),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  const programs = await listAllPrograms();
  return {
    programs: programs.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      priceKobo: p.priceKobo,
      capacity: p.capacity,
      seatsTaken: p.seatsTaken,
      registered: p._count.enrollments,
      startDate: p.startDate,
      sessions: p.sessions.length,
    })),
  };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, programSchema);
  const program = await createProgram(body);
  return { program: { id: program.id, title: program.title } };
});
