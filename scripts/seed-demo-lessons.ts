/**
 * Fills the seeded HTML course with real lesson content, so the LMS can be seen
 * working rather than described.
 *
 *   npx tsx scripts/seed-demo-lessons.ts
 *
 * Idempotent: clears and rebuilds this one course's curriculum. Separate from
 * seed-demo-content.ts because content and curriculum are edited by different
 * people at different times.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { createSection, createLesson } from "@/server/lms/authoring";

const COURSE_SLUG = "html-for-kids";

async function main() {
  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) {
    console.error(`✖ course "${COURSE_SLUG}" not found — run seed-demo-content.ts first`);
    process.exit(1);
  }

  // Rebuild from scratch so re-running does not duplicate the curriculum.
  await prisma.courseSection.deleteMany({ where: { courseId: course.id } });
  await prisma.lesson.deleteMany({ where: { courseId: course.id } });

  const basics = await createSection(
    course.id,
    "Getting started",
    "What a web page is made of, and how to write your first one."
  );

  await createLesson(course.id, {
    title: "What is HTML?",
    kind: "LESSON",
    sectionId: basics.id,
    summary: "Every website you have ever visited is built from it.",
    estimatedMinutes: 8,
    published: true,
    blocks: [
      {
        kind: "TEXT",
        text: "Every website you have ever visited — YouTube, your school's site, a game you play in the browser — is built from something called HTML.\n\nHTML is not really a programming language. It is more like a set of labels you put around your words to tell the browser what each bit IS.",
      },
      { kind: "HEADING", text: "Labels are called tags" },
      {
        kind: "TEXT",
        text: "A tag has angle brackets around it. Most tags come in pairs: one to open, and one to close. The closing one has a slash in it.",
      },
      { kind: "CODE", text: "<p>This is a paragraph.</p>", meta: "html" },
      {
        kind: "CALLOUT",
        text: "The <p> stands for paragraph. Try saying the tags out loud as you write them — it makes them much easier to remember.",
      },
      { kind: "HEADING", text: "Some tags you will use all the time" },
      {
        kind: "LIST",
        text: "<h1> — the biggest heading on the page\n<p> — a paragraph of writing\n<img> — a picture\n<a> — a link to another page",
      },
      {
        kind: "TEXT",
        text: "That is genuinely most of what you need to build a real page. In the next lesson you will write one yourself.",
      },
    ],
  });

  await createLesson(course.id, {
    title: "Your first web page",
    kind: "LESSON",
    sectionId: basics.id,
    summary: "Write it, open it, see it in a browser.",
    estimatedMinutes: 12,
    published: true,
    blocks: [
      {
        kind: "TEXT",
        text: "Open any text editor — Notepad works fine. Type this in exactly as you see it.",
      },
      {
        kind: "CODE",
        text: "<h1>Hello, world!</h1>\n<p>My name is Ada and I am learning to code.</p>",
        meta: "html",
      },
      {
        kind: "TEXT",
        text: "Now save the file. The important part is the name: call it index.html — not index.txt. The .html ending is what tells your computer this is a web page.\n\nThen find the file and double-click it. It will open in your browser, and you will see your words on a real page.",
      },
      {
        kind: "CALLOUT",
        text: "If you see the tags on screen instead of big text, the file was saved as .txt. Rename it so it ends in .html and try again.",
      },
      {
        kind: "HEADING",
        text: "Change something",
      },
      {
        kind: "TEXT",
        text: "Change the words between the tags to your own name. Save the file, then refresh the browser. That loop — edit, save, refresh — is what every web developer in the world does all day.",
      },
    ],
  });

  const structure = await createSection(
    course.id,
    "Building a real page",
    "Headings, lists, links and pictures."
  );

  await createLesson(course.id, {
    title: "Headings and lists",
    kind: "LESSON",
    sectionId: structure.id,
    summary: "Organise your page so people can actually read it.",
    estimatedMinutes: 10,
    published: true,
    blocks: [
      {
        kind: "TEXT",
        text: "Headings come in six sizes, from <h1> down to <h6>. Use <h1> once, for the title of the page, then <h2> for each big section.",
      },
      {
        kind: "CODE",
        text: "<h1>My favourite games</h1>\n<h2>Games I play with friends</h2>\n<h2>Games I play alone</h2>",
        meta: "html",
      },
      { kind: "HEADING", text: "Lists" },
      {
        kind: "TEXT",
        text: "A bullet list is <ul>, and every item inside it is <li>. If you want numbers instead of bullets, use <ol>.",
      },
      {
        kind: "CODE",
        text: "<ul>\n  <li>Football</li>\n  <li>Chess</li>\n  <li>Coding</li>\n</ul>",
        meta: "html",
      },
      {
        kind: "CALLOUT",
        text: "Notice the indenting. It changes nothing about how the page looks — it just makes your code easier for a human to read. Do it anyway.",
      },
    ],
  });

  await createLesson(course.id, {
    title: "Links and pictures",
    kind: "LESSON",
    sectionId: structure.id,
    summary: "Connect your page to the rest of the web.",
    estimatedMinutes: 10,
    published: true,
    blocks: [
      {
        kind: "TEXT",
        text: "A link uses the <a> tag, and it needs to know where to go. That goes in href.",
      },
      { kind: "CODE", text: '<a href="https://codeearly.com">Visit CodeEarly</a>', meta: "html" },
      { kind: "HEADING", text: "Pictures" },
      {
        kind: "TEXT",
        text: "An image tag is different: it has no closing tag, and it always needs alt text describing the picture. That text is read aloud to people who cannot see the image.",
      },
      { kind: "CODE", text: '<img src="cat.jpg" alt="A ginger cat asleep on a keyboard">', meta: "html" },
      {
        kind: "CALLOUT",
        text: "Always write real alt text. Not 'image' or 'picture' — describe what is actually in it.",
      },
    ],
  });

  // A draft, to prove drafts stay invisible to children.
  await createLesson(course.id, {
    title: "Tables (coming soon)",
    kind: "LESSON",
    sectionId: structure.id,
    summary: "Not finished yet.",
    published: false,
    blocks: [{ kind: "TEXT", text: "Still being written." }],
  });

  const counts = await prisma.lesson.groupBy({
    by: ["published"],
    where: { courseId: course.id },
    _count: true,
  });

  console.log(`✔ curriculum rebuilt for "${course.title}"`);
  for (const c of counts) {
    console.log(`  ${c._count} ${c.published ? "published" : "draft"} lesson(s)`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
