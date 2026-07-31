/**
 * Report cards and certificates.
 *
 * These are documents a parent keeps and may hand to a school, so the failures
 * that matter are not crashes: a published report quietly changing its figures, a
 * duplicate certificate for one course, or a withdrawn certificate that verifies
 * as if nothing happened.
 *
 *   npx tsx scripts/check-records.ts
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createChild } from "@/server/members/children";
import {
  saveReportCard,
  unpublishReportCard,
  listReportsForParent,
  issueCertificate,
  issueOutstandingCertificates,
  verifyCertificate,
  revokeCertificate,
} from "@/server/records/reports";
import { isAppError } from "@/lib/errors";

const PARENT_ID = "records-check-parent";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✔" : "  ✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function refuses(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "IT WAS ALLOWED");
  } catch (err) {
    check(label, isAppError(err), isAppError(err) ? err.publicMessage : String(err));
  }
}

async function main() {
  await cleanup();

  await prisma.user.create({
    data: {
      id: PARENT_ID,
      email: "records-check@example.com",
      name: "Records Check",
      emailVerified: true,
      updatedAt: new Date(),
    },
  });
  const child = await createChild({ parentId: PARENT_ID, childName: "Ada" });

  const course = await prisma.course.create({
    data: { title: "Records Check Course", slug: "records-check-course", status: "PUBLISHED" },
  });
  await prisma.courseCompletion.create({
    data: { childId: child.id, courseId: course.id, lessonCount: 3 },
  });

  const start = new Date("2026-01-01");
  const end = new Date("2026-12-31");

  // ── Report cards ───────────────────────────────────────────────────────────
  const draft = await saveReportCard({
    childId: child.id,
    period: "Term 1, 2026",
    periodStart: start,
    periodEnd: end,
    comment: "Ada has worked hard this term.",
    overallGrade: "Excellent",
    publish: false,
  });
  check("draft has no published date", draft.status === "DRAFT" && draft.publishedAt === null);
  check("figures were computed, not typed", draft.coursesCompleted === 1, `${draft.coursesCompleted} course(s)`);

  // A draft is staff working, not a document for a family.
  const hiddenFromParent = await listReportsForParent(PARENT_ID);
  check("drafts are invisible to the parent", hiddenFromParent.length === 0, `${hiddenFromParent.length} shown`);

  await refuses("a period ending before it starts is refused", () =>
    saveReportCard({
      childId: child.id,
      period: "Backwards",
      periodStart: end,
      periodEnd: start,
      publish: false,
    })
  );

  const published = await saveReportCard({
    childId: child.id,
    period: "Term 1, 2026",
    periodStart: start,
    periodEnd: end,
    comment: "Ada has worked hard this term.",
    overallGrade: "Excellent",
    publish: true,
  });
  check("publishing sets the date", published.status === "PUBLISHED" && published.publishedAt !== null);

  const visible = await listReportsForParent(PARENT_ID);
  check("published reports reach the parent", visible.length === 1);

  // Editing a published report would change a document a parent may have
  // printed. It has to be a decision, not an accident.
  await refuses("a published report cannot be edited in place", () =>
    saveReportCard({
      childId: child.id,
      period: "Term 1, 2026",
      periodStart: start,
      periodEnd: end,
      comment: "Rewritten silently",
      publish: true,
    })
  );

  await unpublishReportCard(published.id);
  const afterUnpublish = await prisma.reportCard.findUnique({ where: { id: published.id } });
  check(
    "unpublishing clears the date",
    afterUnpublish?.status === "DRAFT" && afterUnpublish.publishedAt === null
  );

  // ── Certificates ───────────────────────────────────────────────────────────
  const cert = await issueCertificate({
    childId: child.id,
    kind: "COURSE",
    title: course.title,
    subjectId: course.id,
  });
  check("serial looks like a certificate serial", /^CE-CERT-[A-Z0-9]{4}$/.test(cert.serial), cert.serial);
  check("recipient name is frozen on the document", cert.recipientName === "Ada");

  const again = await issueCertificate({
    childId: child.id,
    kind: "COURSE",
    title: course.title,
    subjectId: course.id,
  });
  // Two serials for one course is exactly what a school queries.
  check("issuing twice returns the same certificate", again.id === cert.id);

  const batch = await issueOutstandingCertificates(child.id);
  check("batch issue is idempotent", batch.length === 1 && batch[0]!.id === cert.id);

  // Renaming the course must not change what the framed document says.
  await prisma.course.update({ where: { id: course.id }, data: { title: "Renamed Course" } });
  const afterRename = await verifyCertificate(cert.serial);
  check("renaming the course does not rewrite the certificate", afterRename?.title === "Records Check Course", afterRename?.title);

  // Renaming the child must not either.
  await prisma.child.update({ where: { id: child.id }, data: { childName: "Adaeze" } });
  const afterChildRename = await verifyCertificate(cert.serial);
  check("renaming the child does not rewrite the certificate", afterChildRename?.recipientName === "Ada");

  const unknown = await verifyCertificate("CE-CERT-ZZZZ");
  check("an unknown serial does not verify", unknown === null);

  check("verification exposes no parent details", afterRename !== null && !("parentId" in afterRename));

  await refuses("revoking without a reason is refused", () => revokeCertificate(cert.id, "  "));

  await revokeCertificate(cert.id, "Issued in error");
  const revoked = await verifyCertificate(cert.serial);
  // A revoked certificate that simply vanished would be indistinguishable from a
  // forgery — the opposite of what verification is for.
  check("a revoked certificate still verifies", revoked !== null);
  check("and says it was withdrawn", revoked?.revokedAt !== null && revoked?.revokedReason === "Issued in error");

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL RECORDS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.course.deleteMany({ where: { slug: "records-check-course" } });
  await prisma.user.deleteMany({ where: { id: PARENT_ID } });
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
