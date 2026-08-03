/**
 * Admin FAQs: GET (list) / POST (create)
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { listAllFaqs, saveFaq } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const faqSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(3000),
  category: z.string().trim().max(60).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  order: z.number().int().min(0).max(999),
});

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);
  return { faqs: await listAllFaqs() };
});

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, faqSchema);
  const faq = await saveFaq(body);
  return { faq: { id: faq.id } };
});
