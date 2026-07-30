/**
 * Admin competitions: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listCompetitions, createCompetition } from "@/server/quiz/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const competitionSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.string().trim().max(40),
  status: z.string().trim().max(40),
  visibility: z.enum(["MEMBERS", "UNLISTED", "PUBLIC"]),
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(3).max(500),
        options: z.array(z.string().trim().max(200)).min(2).max(6),
        correctAnswer: z.string().trim().min(1).max(200),
        timeLimitSeconds: z.number().int().min(5).max(300),
      })
    )
    .min(1),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  const competitions = await listCompetitions();
  return {
    competitions: competitions.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      status: c.status,
      visibility: c.visibility,
      questions: c.questions.length,
      sessions: c._count.sessions,
    })),
  };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, competitionSchema);
  const competition = await createCompetition(body);
  return { competition: { id: competition.id, title: competition.title } };
});
