/**
 * Admin blog post: PUT (save) / DELETE
 */
import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { savePost, deletePost } from "@/server/content/content";
import { postSchema } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, postSchema);
  const post = await savePost(body, id);
  return { post: { id: post.id, slug: post.slug, status: post.status } };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  await deletePost(id);
  return { ok: true };
});
