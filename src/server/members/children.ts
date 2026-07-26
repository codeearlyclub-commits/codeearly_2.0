/**
 * Children — the member records under a parent account.
 *
 * A child is not a login. Parents hold the account; children are profiles the
 * parent manages, and a child's identity in a quiz room is their membership ID
 * and display name, never an email address. That keeps us out of the business
 * of holding credentials for minors.
 */
import type { Child } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { generateMembershipId } from "@/lib/ids";

/** How many times to retry when a generated membership ID collides. */
const MAX_ID_ATTEMPTS = 8;

export type CreateChildInput = {
  parentId: string;
  childName: string;
  dateOfBirth?: Date | null;
  gender?: string | null;
};

/**
 * Add a child to a parent's account.
 *
 * The membership ID is allocated with retry rather than a pre-check, because a
 * check-then-insert has a race between the two statements. The unique index is
 * the authority; we just retry when it says no.
 */
export async function createChild(input: CreateChildInput): Promise<Child> {
  const childName = input.childName.trim();
  if (childName.length < 2) {
    throw errors.validation("Please enter the child's name.");
  }
  if (input.dateOfBirth && input.dateOfBirth > new Date()) {
    throw errors.validation("Date of birth cannot be in the future.");
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    try {
      return await prisma.child.create({
        data: {
          parentId: input.parentId,
          membershipId: generateMembershipId(),
          childName,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err, "membershipId")) continue;
      throw err;
    }
  }
  throw errors.internal("Could not allocate a membership ID. Please try again.");
}

/** A parent's children. Ordered oldest-added first so the list is stable. */
export async function listChildren(parentId: string) {
  return prisma.child.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Fetch a child, asserting it belongs to this parent.
 *
 * Ownership is part of the query, not a check afterwards — there is no code
 * path here that can load someone else's child and then forget to compare.
 * "Not yours" and "does not exist" return the same error so the endpoint cannot
 * be used to test whether a membership ID is real.
 */
export async function getOwnedChild(parentId: string, childId: string): Promise<Child> {
  const child = await prisma.child.findFirst({ where: { id: childId, parentId } });
  if (!child) throw errors.notFound("Child not found.", { childId, parentId });
  return child;
}

export async function updateChild(
  parentId: string,
  childId: string,
  data: Partial<Pick<CreateChildInput, "childName" | "dateOfBirth" | "gender">>
): Promise<Child> {
  await getOwnedChild(parentId, childId); // authorise before mutating
  return prisma.child.update({
    where: { id: childId },
    data: {
      ...(data.childName !== undefined ? { childName: data.childName.trim() } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
    },
  });
}

/**
 * Look up a child by membership ID — how a parent finds their own record from
 * a certificate or report card. Deliberately NOT exposed to unauthenticated
 * callers: membership IDs appear on printed material, so an open lookup would
 * turn a certificate photo into a directory of children.
 */
export async function findByMembershipId(membershipId: string) {
  return prisma.child.findUnique({
    where: { membershipId: membershipId.trim().toUpperCase() },
    select: { id: true, childName: true, membershipId: true, parentId: true },
  });
}

/** Prisma's unique-constraint error, narrowed to a specific field. */
function isUniqueViolation(err: unknown, field: string): boolean {
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : target === field;
}
