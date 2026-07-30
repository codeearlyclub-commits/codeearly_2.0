/**
 * Exercises the LMS rules that would otherwise be quietly wrong.
 *
 * The dangerous failures here are not crashes — they are a child losing progress,
 * seeing a draft, or a completion timestamp that disagrees with what a report card
 * later prints.
 *
 *   npx tsx scripts/check-lms.ts
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createChild } from "@/server/members/children";
import { enrolChild } from "@/server/courses/catalog";
import {
  createSection,
  createLesson,
  updateLesson,
  removeLesson,
  deleteSection,
} from "@/server/lms/authoring";
import {
  getCourseForChild,
  getLessonForChild,
  completeLesson,
  saveLessonPosition,
  listChildLearning,
} from "@/server/lms/learning";
import { isAppError } from "@/lib/errors";

const PARENT_ID = "lms-check-parent";
const SLUG = "lms-check-course";

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
      email: "lms-check@example.com",
      name: "LMS Check",
      emailVerified: true,
      updatedAt: new Date(),
    },
  });
  const child = await createChild({ parentId: PARENT_ID, childName: "Ada" });

  const course = await prisma.course.create({
    data: { title: "LMS Check Course", slug: SLUG, status: "PUBLISHED", priceKobo: 0 },
  });

  // ── Authoring ──────────────────────────────────────────────────────────────
  const section = await createSection(course.id, "Getting started", "The basics");
  check("section created at order 0", section.order === 0, `order ${section.order}`);

  const l1 = await createLesson(course.id, {
    title: "What is HTML?",
    kind: "LESSON",
    sectionId: section.id,
    published: true,
    blocks: [
      { kind: "HEADING", text: "HTML is the skeleton" },
      { kind: "TEXT", text: "Every page you visit is built from HTML tags." },
      { kind: "CODE", text: "<p>Hello!</p>", meta: "html" },
    ],
  });
  const l2 = await createLesson(course.id, {
    title: "Your first page",
    kind: "LESSON",
    sectionId: section.id,
    published: true,
    blocks: [{ kind: "TEXT", text: "Now let's build one." }],
  });
  const draft = await createLesson(course.id, {
    title: "Not ready yet",
    kind: "LESSON",
    sectionId: section.id,
    published: false,
    blocks: [{ kind: "TEXT", text: "Work in progress." }],
  });
  check("lessons appended in order", l1.order === 0 && l2.order === 1, `${l1.order}, ${l2.order}`);
  check("slugs derived from titles", l1.slug === "what-is-html", l1.slug);

  await refuses("publishing an empty lesson is refused", () =>
    createLesson(course.id, {
      title: "Empty published lesson",
      kind: "LESSON",
      published: true,
      blocks: [],
    })
  );
  await refuses("an image without alt text is refused", () =>
    createLesson(course.id, {
      title: "Image lesson",
      kind: "LESSON",
      published: false,
      blocks: [{ kind: "IMAGE", text: "https://example.com/a.png" }],
    })
  );
  await refuses("a non-URL video is refused", () =>
    createLesson(course.id, {
      title: "Bad video",
      kind: "LESSON",
      published: false,
      videoUrl: "youtube dot com",
      blocks: [{ kind: "TEXT", text: "x" }],
    })
  );

  // Renaming a PUBLISHED lesson must not move its URL — a child may have
  // bookmarked it, and a parent may have been sent the link.
  // Keeps three blocks so the ordering assertion further down stays meaningful,
  // while still proving replacement (an append would leave six).
  const renamed = await updateLesson(l1.id, {
    title: "What is HTML, really?",
    kind: "LESSON",
    sectionId: section.id,
    published: true,
    blocks: [
      { kind: "HEADING", text: "HTML is the skeleton" },
      { kind: "TEXT", text: "Still the structure of every page you visit." },
      { kind: "CODE", text: "<p>Hello!</p>", meta: "html" },
    ],
  });
  check("renaming a published lesson keeps its slug", renamed.slug === l1.slug, renamed.slug);

  // An unpublished lesson has no audience yet, so its slug may still follow.
  const draftRenamed = await updateLesson(draft.id, {
    title: "Nearly ready",
    kind: "LESSON",
    sectionId: section.id,
    published: false,
    blocks: [{ kind: "TEXT", text: "Work in progress." }],
  });
  check("renaming a draft updates its slug", draftRenamed.slug === "nearly-ready", draftRenamed.slug);

  // Replacing blocks must not orphan the old ones.
  const blockCount = await prisma.lessonBlock.count({ where: { lessonId: l1.id } });
  check("blocks are replaced, not appended", blockCount === 3, `${blockCount} block(s)`);

  // ── Access ─────────────────────────────────────────────────────────────────
  await refuses("a child not enrolled cannot open the course", () =>
    getCourseForChild(child.id, PARENT_ID, SLUG)
  );

  await enrolChild(child.id, PARENT_ID, course.id);
  const view = await getCourseForChild(child.id, PARENT_ID, SLUG);
  check("enrolled child sees the course", view.course.id === course.id);
  check("drafts are hidden from the child", view.totalLessons === 2, `${view.totalLessons} lessons`);
  check("progress starts at 0%", view.percentComplete === 0);
  check("continue points at the first lesson", view.continueFrom?.id === l1.id);

  await refuses("a draft lesson cannot be opened directly", () =>
    getLessonForChild(child.id, PARENT_ID, SLUG, draft.slug)
  );

  // ── Reading ────────────────────────────────────────────────────────────────
  const opened = await getLessonForChild(child.id, PARENT_ID, SLUG, l1.slug);
  check("blocks come back in order", opened.lesson.blocks.map((b) => b.order).join() === "0,1,2");
  check("opening records IN_PROGRESS", opened.progress.status === "IN_PROGRESS");
  check("next lesson is resolved", opened.next?.id === l2.id);
  check("previous is null on the first lesson", opened.previous === null);

  await saveLessonPosition(child.id, l1.id, 2);
  const back = await saveLessonPosition(child.id, l1.id, 1);
  // Scrolling back up must not lose your place.
  check("position only moves forward", back.lastBlockOrder === 2, `order ${back.lastBlockOrder}`);

  // ── Completion ─────────────────────────────────────────────────────────────
  const done = await completeLesson(child.id, l1.id);
  check("completion sets a timestamp", done.status === "COMPLETED" && done.completedAt !== null);

  const firstAt = done.completedAt!.getTime();
  await new Promise((r) => setTimeout(r, 30));
  const again = await completeLesson(child.id, l1.id);
  // When they finished is a fact, not something a second click rewrites.
  check("completing twice keeps the first timestamp", again.completedAt!.getTime() === firstAt);

  // Re-reading something you finished must not undo the record.
  await getLessonForChild(child.id, PARENT_ID, SLUG, l1.slug);
  const after = await prisma.lessonProgress.findUnique({
    where: { childId_lessonId: { childId: child.id, lessonId: l1.id } },
  });
  check("re-opening a completed lesson does not reset it", after?.status === "COMPLETED", after?.status);

  const half = await getCourseForChild(child.id, PARENT_ID, SLUG);
  check("progress is 50% after one of two", half.percentComplete === 50, `${half.percentComplete}%`);
  check("continue moves to the unfinished lesson", half.continueFrom?.id === l2.id);

  const dash = await listChildLearning(child.id);
  check("dashboard reports the same progress", dash[0]?.percentComplete === 50, `${dash[0]?.percentComplete}%`);

  // ── Destructive edits must not erase history ───────────────────────────────
  const removal = await removeLesson(l1.id);
  check("a lesson with progress is unpublished, not deleted", removal.unpublished === true);
  const survived = await prisma.lessonProgress.count({ where: { lessonId: l1.id } });
  check("its progress survived", survived === 1, `${survived} row(s)`);

  const untouched = await removeLesson(draft.id);
  check("an untouched lesson is deleted outright", untouched.unpublished === false);

  await deleteSection(section.id);
  const orphan = await prisma.lesson.findUnique({ where: { id: l2.id } });
  // Removing a chapter heading must not destroy the lessons inside it.
  check("deleting a section keeps its lessons", orphan !== null && orphan.sectionId === null);

  // ── The database backstop ──────────────────────────────────────────────────
  let blocked = false;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "LessonProgress" SET "status" = 'COMPLETED', "completedAt" = NULL WHERE "lessonId" = '${l1.id}'`
    );
  } catch {
    blocked = true;
  }
  check("DB refuses COMPLETED without a timestamp", blocked);

  let blankBlocked = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LessonBlock" ("id","lessonId","kind","text","order") VALUES ('blank-1','${l2.id}','TEXT','   ',0)`
    );
  } catch {
    blankBlocked = true;
  }
  check("DB refuses a blank content block", blankBlocked);

  await cleanup();
  await prisma.$disconnect();
  console.log(failures === 0 ? "\nALL LMS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exit(1);
}

async function cleanup() {
  await prisma.course.deleteMany({ where: { slug: SLUG } });
  await prisma.user.deleteMany({ where: { id: PARENT_ID } });
}

main().catch(async (err) => {
  console.error("check failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
