/**
 * Tenancy guard — the single chokepoint for "may this user act on this org?".
 *
 * This is the most safety-critical file in the public quiz product. Every
 * org-scoped read or write goes through `requireOrgAccess` first. There is no
 * ambient "current organization" anywhere in the codebase, because an implicit
 * tenant is a cross-tenant data leak waiting for one forgotten `where` clause.
 */
import type { OrgRole, Organization } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { SYSTEM_ORG_ID } from "@/lib/constants";

/** Ascending privilege. A HOST can run quizzes; only an OWNER can delete the org. */
const RANK: Record<OrgRole, number> = { HOST: 1, ADMIN: 2, OWNER: 3 };

export type OrgAccess = {
  org: Organization;
  role: OrgRole;
  /** True when access came from a CodeEarly platform admin, not org membership. */
  viaPlatformAdmin: boolean;
};

/**
 * Assert that `userId` may act on `organizationId` at `minRole` or above.
 *
 * Returns the organization so callers don't re-fetch it — that also means the
 * only ergonomic way to get an Organization is through the permission check.
 *
 * @param isPlatformAdmin pass the CodeEarly admin flag from the session. A
 * platform admin can support any tenant, but the access is labelled so it can
 * be logged differently — staff acting on a customer's data should be
 * auditable, not indistinguishable from the customer.
 */
export async function requireOrgAccess(
  userId: string,
  organizationId: string,
  minRole: OrgRole = "HOST",
  isPlatformAdmin = false
): Promise<OrgAccess> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw errors.notFound("Organisation not found.", { organizationId });

  if (isPlatformAdmin) {
    return { org, role: "OWNER", viaPlatformAdmin: true };
  }

  // Nobody holds membership of the platform's own tenant — it is administered
  // only by CodeEarly staff, through the branch above.
  if (org.id === SYSTEM_ORG_ID) {
    throw errors.forbidden("You do not have access to this.", { organizationId });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: organizationId, userId } },
    select: { role: true },
  });

  // Same message for "not a member" and "insufficient role": a distinct reply
  // would confirm the organisation exists to someone probing ids.
  if (!membership || RANK[membership.role] < RANK[minRole]) {
    throw errors.forbidden("You do not have access to this.", {
      organizationId,
      userId,
      required: minRole,
      actual: membership?.role ?? null,
    });
  }

  return { org, role: membership.role, viaPlatformAdmin: false };
}

/**
 * Every organisation a user belongs to — for the org switcher. Ordered so the
 * one they own comes first.
 */
export async function listUserOrgs(userId: string) {
  return prisma.orgMember.findMany({
    where: { userId },
    select: {
      role: true,
      org: {
        select: { id: true, name: true, slug: true, planKey: true, status: true, logoUrl: true },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
}

/**
 * Guard for quiz data specifically: confirms the competition belongs to the org
 * the caller was authorised for. Checking the competition's own
 * `organizationId` — rather than trusting an id from the request — is what
 * makes a forged competition id in a URL useless.
 */
export async function requireCompetitionInOrg(
  competitionId: string,
  organizationId: string
) {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, organizationId: true, title: true, visibility: true },
  });
  if (!competition || competition.organizationId !== organizationId) {
    throw errors.notFound("Quiz not found.", { competitionId, organizationId });
  }
  return competition;
}
