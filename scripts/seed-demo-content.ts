/**
 * Seeds a realistic course and program catalogue.
 *
 * Separate from prisma/seed.ts on purpose: that one seeds things the platform
 * cannot boot without (plan catalogue, SYSTEM org) and runs on every deploy.
 * This one seeds *content*, which in production comes from the admin — running
 * it against real data would fight whatever the team has actually published.
 *
 *   npx tsx scripts/seed-demo-content.ts
 *
 * Idempotent: upserts by slug, so re-running updates rather than duplicating.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

const COURSES = [
  {
    slug: "scratch-for-kids",
    title: "Scratch Programming for Kids",
    description:
      "Drag-and-drop coding that turns into real games and animations. The perfect first step — no typing or reading speed required.",
    level: "Beginner",
    ageRange: "6-9",
    priceKobo: 0,
    requiresSubscription: true,
    sortOrder: 1,
  },
  {
    slug: "html-for-kids",
    title: "HTML for Kids",
    description:
      "Build your very first web page. Children learn how the websites they use every day are actually put together.",
    level: "Beginner",
    ageRange: "8-12",
    priceKobo: 0,
    requiresSubscription: true,
    sortOrder: 2,
  },
  {
    slug: "css-for-kids",
    title: "CSS for Kids",
    description:
      "Make it beautiful. Colours, layouts and animations that turn a plain page into something worth showing off.",
    level: "Beginner",
    ageRange: "8-12",
    priceKobo: 0,
    requiresSubscription: true,
    sortOrder: 3,
  },
  {
    slug: "web-design-superkoder",
    title: "SuperKoder Web Design",
    description:
      "HTML and CSS together, start to finish, ending in a personal website your child builds and publishes themselves.",
    level: "Intermediate",
    ageRange: "10-14",
    priceKobo: 2_500_000,
    requiresSubscription: false,
    sortOrder: 4,
  },
  {
    slug: "javascript-for-preteens",
    title: "JavaScript for Pre-Teens",
    description:
      "Make web pages think and react. Real programming — variables, loops and logic — taught through games.",
    level: "Intermediate",
    ageRange: "11-15",
    priceKobo: 3_000_000,
    requiresSubscription: false,
    sortOrder: 5,
  },
  {
    slug: "python-novice",
    title: "Python for Young Coders",
    description:
      "The language used by scientists and game studios. Children write real code and see it run immediately.",
    level: "Intermediate",
    ageRange: "11-16",
    priceKobo: 3_500_000,
    requiresSubscription: false,
    sortOrder: 6,
  },
  {
    slug: "ai-super-guru",
    title: "AI Super Guru",
    description:
      "How artificial intelligence actually works, and how to use it responsibly — taught in language a child understands.",
    level: "Advanced",
    ageRange: "12-16",
    priceKobo: 4_000_000,
    requiresSubscription: false,
    sortOrder: 7,
  },
];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function main() {
  for (const course of COURSES) {
    await prisma.course.upsert({
      where: { slug: course.slug },
      update: { ...course, status: "PUBLISHED" },
      create: { ...course, status: "PUBLISHED" },
    });
  }
  console.log(`✔ ${COURSES.length} courses published`);

  const bootcampTitle = "Holiday Coding Bootcamp";
  const existing = await prisma.program.findFirst({ where: { title: bootcampTitle } });

  const programData = {
    title: bootcampTitle,
    type: "Holiday",
    description:
      "Two weeks of live classes in a small group. Every child finishes with a game or website they built themselves, and presents it on the final day.",
    ageRange: "8-14",
    location: "Online + Abuja centre",
    status: "PUBLISHED" as const,
    featuredOnHomepage: true,
    priceKobo: 7_500_000,
    regularPriceKobo: 9_000_000,
    capacity: 24,
    startDate: daysFromNow(21),
    endDate: daysFromNow(35),
    registrationDeadline: daysFromNow(14),
  };

  const program = existing
    ? await prisma.program.update({ where: { id: existing.id }, data: programData })
    : await prisma.program.create({ data: programData });

  // Sessions are replaced wholesale rather than upserted — they are a schedule,
  // and a half-updated schedule is worse than a rewritten one.
  await prisma.programSession.deleteMany({ where: { programId: program.id } });
  await prisma.programSession.createMany({
    data: [
      { programId: program.id, title: "Week 1 · Getting started", date: daysFromNow(21) },
      { programId: program.id, title: "Week 1 · Building your first page", date: daysFromNow(24) },
      { programId: program.id, title: "Week 2 · Making it interactive", date: daysFromNow(28) },
      { programId: program.id, title: "Week 2 · Project showcase", date: daysFromNow(35) },
    ],
  });

  console.log(`✔ program "${program.title}" published with 4 sessions`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
