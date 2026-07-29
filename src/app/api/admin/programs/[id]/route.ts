/**
 * Admin program: PATCH (update) / DELETE (archive or remove)
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { updateProgram, removeProgram } from "@/server/programs/admin";
import { programSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, programSchema);
  const program = await updateProgram(id, body);
  return { program: { id: program.id, title: program.title, status: program.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  return removeProgram(id);
});
