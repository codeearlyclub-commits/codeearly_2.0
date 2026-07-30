/**
 * Admin view of families.
 *
 * Deliberately shaped around the parent rather than the child: support requests
 * arrive as "my daughter can't sign in" from an email address we can look up,
 * and the answer nearly always needs the whole household — which children,
 * which membership, what they owe.
 */
import { prisma } from "@/lib/prisma";

export type MemberSearch = {
  q?: string;
  take?: number;
};

/**
 * Search parents by their own details or by any of their children's names and
 * membership IDs. A membership ID printed on a certificate is often the only
 * identifier a parent can quote, so it has to resolve here.
 */
export async function listFamilies({ q, take = 50 }: MemberSearch) {
  const term = q?.trim();

  const where = term
    ? {
        OR: [
          { email: { contains: term, mode: "insensitive" as const } },
          { name: { contains: term, mode: "insensitive" as const } },
          { phone: { contains: term } },
          {
            children: {
              some: {
                OR: [
                  { childName: { contains: term, mode: "insensitive" as const } },
                  { membershipId: { contains: term.toUpperCase() } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const parents = await prisma.user.findMany({
    where: { ...where, role: { not: "admin" } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      createdAt: true,
      children: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          childName: true,
          membershipId: true,
          loginEnabled: true,
          _count: { select: { enrollments: true, programEnrollments: true } },
        },
      },
      subscriptions: {
        where: { status: "active", endDate: { gt: new Date() } },
        select: { planName: true, endDate: true, childId: true },
      },
      invoices: {
        where: { status: "PENDING" },
        select: { amountKobo: true },
      },
    },
  });

  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    emailVerified: p.emailVerified,
    createdAt: p.createdAt,
    children: p.children.map((c) => ({
      id: c.id,
      name: c.childName,
      membershipId: c.membershipId,
      studentLogin: c.loginEnabled,
      courses: c._count.enrollments,
      programs: c._count.programEnrollments,
    })),
    memberships: p.subscriptions.map((s) => ({
      plan: s.planName,
      until: s.endDate,
      childId: s.childId,
    })),
    // Surfaced as a single number because "do they owe us anything?" is the
    // question support actually asks, not "list their invoices".
    owedKobo: p.invoices.reduce((sum, i) => sum + i.amountKobo, 0),
  }));
}

export async function familyCounts() {
  const [parents, children, unverified, withStudentLogin] = await Promise.all([
    prisma.user.count({ where: { role: { not: "admin" } } }),
    prisma.child.count(),
    prisma.user.count({ where: { role: { not: "admin" }, emailVerified: false } }),
    prisma.child.count({ where: { loginEnabled: true } }),
  ]);
  return { parents, children, unverified, withStudentLogin };
}
