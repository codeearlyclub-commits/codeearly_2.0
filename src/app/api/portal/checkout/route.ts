/**
 * Checkout: POST /api/portal/checkout
 *
 * The client sends only what and for whom — never a price. Everything monetary
 * is read from the database inside the service.
 *
 * Requires a VERIFIED parent: this spends money and grants access, and an
 * unverified address is an unowned account.
 */
import { z } from "zod";

import { apiHandler, parseBody, clientIp } from "@/lib/api";
import { requireVerifiedParent } from "@/lib/session";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { checkoutCourse, checkoutProgram } from "@/server/invoices/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["course", "program"]),
  childId: z.string().min(1),
  itemId: z.string().min(1),
});

export const POST = apiHandler(async (req) => {
  const parent = await requireVerifiedParent(req);
  const body = await parseBody(req, schema);

  await enforceRateLimit(
    `checkout:${parent.userId}:${clientIp(req)}`,
    LIMITS.paymentInit.limit,
    LIMITS.paymentInit.window
  );

  const result =
    body.kind === "course"
      ? await checkoutCourse(parent.userId, parent.email, body.childId, body.itemId)
      : await checkoutProgram(parent.userId, parent.email, body.childId, body.itemId);

  return result;
});
