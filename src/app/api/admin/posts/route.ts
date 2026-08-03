/**
 * Admin blog posts: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllPosts, savePost } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const postSchema = z.object({
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().max(400).optional().nullable(),
  author: z.string().trim().max(80),
  coverUrl: z.string().trim().max(600).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(12),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  blocks: z
    .array(
      z.object({
        kind: z.enum(["HEADING", "TEXT", "CODE", "IMAGE", "VIDEO", "CALLOUT", "LIST"]),
        text: z.string().max(20_000),
        meta: z.string().trim().max(400).optional().nullable(),
      })
    )
    .max(200),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  return { posts: await listAllPosts() };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, postSchema);
  const post = await savePost(body);
  return { post: { id: post.id, slug: post.slug } };
});
