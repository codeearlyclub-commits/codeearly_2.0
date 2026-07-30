/**
 * Admin competition: PATCH (update) / DELETE (remove) / POST (duplicate)
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import {
  updateCompetition,
  removeCompetition,
  duplicateCompetition,
} from "@/server/quiz/admin";
import { competitionSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, competitionSchema);
  const competition = await updateCompetition(id, body);
  return { competition: { id: competition.id, title: competition.title } };
});

/** POST on an existing id means "duplicate this one". */
export const POST = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const copy = await duplicateCompetition(id);
  return { competition: { id: copy.id, title: copy.title } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await removeCompetition(id);
  return { deleted: true };
});
