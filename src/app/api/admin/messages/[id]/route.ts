/**
 * Admin enquiry: PATCH (change status)
 *
 * No DELETE. An enquiry is a record of someone asking us something; archiving
 * removes it from the working inbox, which is what "delete" actually means here.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { setMessageStatus } from "@/server/content/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]),
});

export const PATCH = apiHandler<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const { status } = await parseBody(req, schema);
  const message = await setMessageStatus(id, status, admin.email);
  return { message: { id: message.id, status: message.status } };
});
