/**
 * Unsubscribe: POST /api/newsletter/unsubscribe
 *
 * POST, not GET, and that is deliberate. Corporate mail scanners and link
 * previewers fetch every URL in an email; a GET unsubscribe link would quietly
 * remove people who never clicked anything. So the emailed link opens a page,
 * and the page posts here.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { unsubscribeByToken } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().trim().min(10).max(120) });

export const POST = apiHandler(async (req) => {
  const { token } = await parseBody(req, schema);
  const subscriber = await unsubscribeByToken(token);
  return { ok: true, email: subscriber.email };
});
