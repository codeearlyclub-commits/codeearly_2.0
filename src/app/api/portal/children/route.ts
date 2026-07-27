/**
 * Children: GET (list) and POST (add) — /api/portal/children
 *
 * Parent-only. A child's own restricted session must not reach this: listing
 * siblings is exactly the kind of data a child login is scoped away from.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireParent, requireVerifiedParent } from "@/lib/session";
import { listChildren, createChild } from "@/server/members/children";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const parent = await requireParent(req);
  const children = await listChildren(parent.userId);

  // Shaped explicitly rather than returned raw — pinHash and lockout state
  // live on this row and must never leave the server.
  return {
    children: children.map((c) => ({
      id: c.id,
      name: c.childName,
      membershipId: c.membershipId,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      studentLoginEnabled: c.loginEnabled,
      createdAt: c.createdAt,
    })),
  };
});

const createSchema = z.object({
  childName: z.string().min(2).max(80),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().max(20).optional(),
});

export const POST = apiHandler(async (req) => {
  // Verified email required: adding children is the first step toward records
  // that carry a real child's name, and an unverified address is an unowned
  // account.
  const parent = await requireVerifiedParent(req);
  const body = await parseBody(req, createSchema);

  const child = await createChild({
    parentId: parent.userId,
    childName: body.childName,
    dateOfBirth: body.dateOfBirth ?? null,
    gender: body.gender ?? null,
  });

  return {
    child: {
      id: child.id,
      name: child.childName,
      membershipId: child.membershipId,
    },
  };
});
