/**
 * Admin showcase: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllShowcase, saveShowcase } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const showcaseSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  // No max beyond a sane cap; the "first name only" rule is enforced in the
  // service, where it can explain itself.
  childFirstName: z.string().trim().min(1).max(40),
  childAge: z.number().int().min(3).max(18).optional().nullable(),
  mediaUrl: z.string().trim().max(600).optional().nullable(),
  projectUrl: z.string().trim().max(600).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(12),
  featured: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  consentBy: z.string().trim().max(120).optional().nullable(),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  return { projects: await listAllShowcase() };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, showcaseSchema);
  const project = await saveShowcase(body);
  return { project: { id: project.id, slug: project.slug } };
});
