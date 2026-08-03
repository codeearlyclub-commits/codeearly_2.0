/**
 * Admin showcase entry: PUT (save) / DELETE
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { saveShowcase, deleteShowcase } from "@/server/content/content";
import { showcaseSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, showcaseSchema);
  const project = await saveShowcase(body, id);
  return { project: { id: project.id, slug: project.slug, status: project.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteShowcase(id);
  return { ok: true };
});
