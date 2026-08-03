/**
 * Admin FAQ: PUT (save) / DELETE
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { saveFaq, deleteFaq } from "@/server/content/content";
import { faqSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, faqSchema);
  const faq = await saveFaq(body, id);
  return { faq: { id: faq.id, status: faq.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deleteFaq(id);
  return { ok: true };
});
