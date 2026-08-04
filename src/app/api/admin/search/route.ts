/**
 * Admin quick search: GET /api/admin/search?q=…
 *
 * Powers the ⌘K palette. Deliberately narrow — it answers "take me to the thing
 * I am thinking of", not "run a report". So it returns a handful of results per
 * type with a URL, and nothing else.
 *
 * Every branch is capped and every query is `contains` on an indexed-ish column
 * with a small `take`. A palette that fires on every keystroke must not be able
 * to become a table scan.
 */
import { apiHandler } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchHit = {
  id: string;
  type: "child" | "parent" | "course" | "program" | "invoice" | "post";
  title: string;
  subtitle: string;
  href: string;
};

const TAKE = 5;

export const GET = apiHandler(async (req) => {
  await requireAdmin(req);

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  // Two characters is the point where results stop being "everything".
  if (q.length < 2) return { hits: [] as SearchHit[] };

  const like = { contains: q, mode: "insensitive" as const };

  const [children, parents, courses, programs, invoices, posts] = await Promise.all([
    prisma.child.findMany({
      where: { OR: [{ childName: like }, { membershipId: like }] },
      take: TAKE,
      select: { id: true, childName: true, membershipId: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: like }, { email: like }] },
      take: TAKE,
      select: { id: true, name: true, email: true },
    }),
    prisma.course.findMany({
      where: { title: like },
      take: TAKE,
      select: { id: true, title: true, status: true },
    }),
    prisma.program.findMany({
      where: { title: like },
      take: TAKE,
      select: { id: true, title: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { OR: [{ invoiceNumber: like }, { description: like }] },
      take: TAKE,
      select: { id: true, invoiceNumber: true, description: true, status: true },
    }),
    prisma.blogPost.findMany({
      where: { title: like },
      take: TAKE,
      select: { id: true, title: true, status: true },
    }),
  ]);

  const hits: SearchHit[] = [
    // Children first: "where are Ada's reports" is the single most common thing
    // anyone types into this box.
    ...children.map((c) => ({
      id: c.id,
      type: "child" as const,
      title: c.childName,
      subtitle: c.membershipId,
      href: `/admin/records?childId=${c.id}`,
    })),
    ...parents.map((p) => ({
      id: p.id,
      type: "parent" as const,
      title: p.name || p.email,
      subtitle: p.email,
      href: `/admin/members?q=${encodeURIComponent(p.email)}`,
    })),
    ...courses.map((c) => ({
      id: c.id,
      type: "course" as const,
      title: c.title,
      subtitle: c.status,
      href: `/admin/courses/${c.id}`,
    })),
    ...programs.map((p) => ({
      id: p.id,
      type: "program" as const,
      title: p.title,
      subtitle: p.status,
      href: `/admin/programs`,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      type: "invoice" as const,
      title: i.invoiceNumber,
      subtitle: `${i.description} · ${i.status}`,
      href: `/admin/invoices?q=${encodeURIComponent(i.invoiceNumber)}`,
    })),
    ...posts.map((p) => ({
      id: p.id,
      type: "post" as const,
      title: p.title,
      subtitle: p.status,
      href: `/admin/blog/${p.id}`,
    })),
  ];

  return { hits };
});
