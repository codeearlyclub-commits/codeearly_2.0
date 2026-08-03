/**
 * Seeds the public content surfaces: blog, showcase, events, testimonials, FAQs.
 *
 * Separate from seed-demo-content.ts (courses and programs) because this is the
 * stuff the marketing side of the site renders, and it is useful to be able to
 * reset one without the other.
 *
 *   npx tsx scripts/seed-demo-site.ts
 *
 * Idempotent: upserts by slug or question, so re-running updates rather than
 * duplicating.
 *
 * NOTE ON THE SHOWCASE FIXTURES: first names only, and each carries a recorded
 * consent line. That is not decoration — the database refuses to publish a
 * showcase entry without it, so a fixture with a blank consent field would
 * simply fail to seed. Seeding the safe shape is the point.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { savePost, saveShowcase, saveEvent } from "@/server/content/content";

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

const POSTS = [
  {
    title: "Your child does not need a laptop to start coding",
    excerpt:
      "A shared phone and an hour on a Saturday is enough for the first few months. Here is what actually matters.",
    tags: ["Parents", "Getting started"],
    blocks: [
      { kind: "TEXT" as const, text: "The question we are asked most often is about equipment.\n\nThe honest answer: for a child under ten, the device barely matters. What matters is that they can see what they built, and that somebody sits next to them the first three times." },
      { kind: "HEADING" as const, text: "What we actually recommend" },
      { kind: "LIST" as const, text: "Any device with a browser — a phone works for Scratch Junior\nA quiet 45 minutes, twice a week, at the same time\nSomewhere to show the finished thing to a real person" },
      { kind: "CALLOUT" as const, text: "Children who present their work to someone every week keep going roughly twice as long as those who don't. That is the single biggest lever a parent has." },
      { kind: "TEXT" as const, text: "When a laptop does become necessary — usually around the point they start writing Python — a second-hand machine is fine. Nothing we teach needs more than a browser and a text editor." },
    ],
  },
  {
    title: "Teaching a seven-year-old to debug",
    excerpt:
      "Debugging is a feeling before it is a skill. Most of the work is staying calm when something breaks.",
    tags: ["Parents", "Scratch"],
    blocks: [
      { kind: "TEXT" as const, text: "The first time a child's program does not work, they learn something about themselves rather than about computers." },
      { kind: "HEADING" as const, text: "Read the error together" },
      { kind: "TEXT" as const, text: "Out loud. Slowly. Most error messages say exactly what is wrong, and most children have never been told that they are meant to be read at all." },
      { kind: "HEADING" as const, text: "Change one thing" },
      { kind: "TEXT" as const, text: "Then run it again. Changing three things at once and hoping is the habit to break early — it is also the habit most adults have." },
      { kind: "CODE" as const, text: 'print("this line runs")\nprint("does this one?")', meta: "python" },
      { kind: "TEXT" as const, text: "Two print statements have solved more problems in our classes than any debugger." },
    ],
  },
  {
    title: "What happens in a CodeEarly holiday programme",
    excerpt:
      "Two weeks, small groups, and a project every child presents on the last day. A look at how it runs.",
    tags: ["Programs"],
    blocks: [
      { kind: "TEXT" as const, text: "Every holiday programme ends the same way: each child stands up and shows what they made. Everything else is arranged around making that moment go well." },
      { kind: "LIST" as const, text: "Week one — the idea, and the smallest version of it that works\nWeek two — making it good enough to show\nFinal day — every child presents, parents invited" },
      { kind: "TEXT" as const, text: "Groups are capped so that an instructor can get to every child twice in a session. That cap is the reason places run out." },
    ],
  },
];

const PROJECTS = [
  {
    title: "Lagos Traffic — a dodging game",
    description:
      "A Scratch game where you drive a danfo through three lanes of traffic. Built over four Saturdays, including the sound effects.",
    childFirstName: "Zainab",
    childAge: 10,
    tags: ["Scratch", "Game"],
    featured: true,
    consentBy: "Parent consent recorded at enrolment",
  },
  {
    title: "My sister's bakery website",
    description:
      "A one-page site with a menu and a WhatsApp order button. First project after finishing HTML for Kids.",
    childFirstName: "Tobi",
    childAge: 12,
    tags: ["HTML", "Web"],
    featured: false,
    consentBy: "Parent consent recorded at enrolment",
  },
  {
    title: "Quiz bot for my class",
    description:
      "A Python program that asks ten maths questions and keeps score. Now used by a teacher at his school.",
    childFirstName: "Chidera",
    childAge: 14,
    tags: ["Python"],
    featured: false,
    consentBy: "Parent consent recorded at enrolment",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I signed her up expecting a hobby. Six months later she is teaching her younger brother, and she asks for the laptop before she asks for the TV.",
    author: "Mrs Adeyemi",
    role: "Parent of two members",
  },
  {
    quote:
      "What sold me was the Friday quiz. He would not do homework, but he would not miss that quiz for anything.",
    author: "Mr Bassey",
    role: "Parent, Abuja",
  },
  {
    quote:
      "The instructors actually know the children by name. In a class of this price, I did not expect that.",
    author: "Mrs Okafor",
    role: "Parent, Lagos",
  },
  {
    quote:
      "He presented his game to the whole group on the last day. He is nine and he has never spoken in front of people before.",
    author: "Mrs Eze",
    role: "Parent, holiday programme",
  },
];

const FAQS = [
  {
    category: "Getting started",
    question: "What age do you take children from?",
    answer:
      "Seven. Below that, most children are still building the reading speed the courses assume. If your child is six and already reading well, talk to us — we have made exceptions.",
  },
  {
    category: "Getting started",
    question: "Does my child need their own email address?",
    answer:
      "No. You hold the account. Each child gets a profile under it, and their own sign-in code and PIN that you can change or revoke at any time. They never see billing and they cannot message anyone.",
  },
  {
    category: "Getting started",
    question: "What equipment do we need?",
    answer:
      "Any device with a modern browser to start. Scratch works on a phone or tablet. From around age eleven, once they move into Python, a laptop makes life much easier — second-hand is fine.",
  },
  {
    category: "Money",
    question: "Can I pay monthly?",
    answer:
      "Yes. Membership is billed monthly and you can cancel from your portal at any time — it stays active until the end of the period you have paid for. Holiday programmes are a single payment.",
  },
  {
    category: "Money",
    question: "Do you offer a discount for siblings?",
    answer:
      "Yes. Get in touch before you enrol the second child and we will apply it — it is not automatic in the checkout yet.",
  },
  {
    category: "Safety",
    question: "Can my child talk to other children on the platform?",
    answer:
      "There is no free-text chat anywhere in CodeEarly. Children can join quizzes and see a leaderboard of first names; that is the whole of the social surface. It is built this way deliberately.",
  },
  {
    category: "Safety",
    question: "What do you do with my child's data?",
    answer:
      "We store their first name, age range and their progress through lessons. No third-party analytics or advertising trackers run on any page a child can reach. Our privacy policy sets out the detail.",
  },
];

async function main() {
  for (const post of POSTS) {
    const existing = await prisma.blogPost.findFirst({ where: { title: post.title } });
    await savePost(
      {
        title: post.title,
        excerpt: post.excerpt,
        author: "CodeEarly Team",
        coverUrl: null,
        tags: post.tags,
        status: "PUBLISHED",
        blocks: post.blocks.map((b) => ({ ...b, meta: "meta" in b ? b.meta : null })),
      },
      existing?.id
    );
  }
  console.log(`✔ ${POSTS.length} blog posts published`);

  for (const project of PROJECTS) {
    const existing = await prisma.showcaseProject.findFirst({ where: { title: project.title } });
    await saveShowcase(
      {
        title: project.title,
        description: project.description,
        childFirstName: project.childFirstName,
        childAge: project.childAge,
        mediaUrl: null,
        projectUrl: null,
        tags: project.tags,
        featured: project.featured,
        status: "PUBLISHED",
        consentBy: project.consentBy,
      },
      existing?.id
    );
  }
  console.log(`✔ ${PROJECTS.length} showcase projects published`);

  const EVENTS = [
    {
      title: "Open Day — see a class before you join",
      description:
        "Come and watch a real session, meet the instructors, and let your child try Scratch for half an hour. No commitment, and no sales pitch.",
      startsAt: daysFromNow(9),
      location: "Abuja centre",
      capacity: 40,
    },
    {
      title: "Holiday Showcase — the children present",
      description:
        "Every child on the holiday programme presents what they built. Parents, siblings and grandparents all welcome.",
      startsAt: daysFromNow(36),
      location: "Abuja centre",
      capacity: 120,
    },
    {
      title: "Parents' evening: raising a child who codes",
      description:
        "An hour online for parents only. What to expect at each age, what to buy and what not to, and how to help without taking over.",
      startsAt: daysFromNow(17),
      location: null,
      capacity: null,
    },
  ];

  for (const event of EVENTS) {
    const existing = await prisma.event.findFirst({ where: { title: event.title } });
    await saveEvent(
      {
        title: event.title,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: null,
        location: event.location,
        virtualLink: event.location === null ? "https://meet.example.com/codeearly" : null,
        capacity: event.capacity,
        status: "PUBLISHED",
      },
      existing?.id
    );
  }
  console.log(`✔ ${EVENTS.length} events published`);

  for (const [i, t] of TESTIMONIALS.entries()) {
    const existing = await prisma.testimonial.findFirst({ where: { quote: t.quote } });
    const data = { ...t, status: "PUBLISHED" as const, order: i };
    if (existing) await prisma.testimonial.update({ where: { id: existing.id }, data });
    else await prisma.testimonial.create({ data });
  }
  console.log(`✔ ${TESTIMONIALS.length} testimonials published`);

  for (const [i, f] of FAQS.entries()) {
    const existing = await prisma.faq.findFirst({ where: { question: f.question } });
    const data = { ...f, status: "PUBLISHED" as const, order: i };
    if (existing) await prisma.faq.update({ where: { id: existing.id }, data });
    else await prisma.faq.create({ data });
  }
  console.log(`✔ ${FAQS.length} FAQs published`);

  console.log("\nDone. /blog, /showcase, /events and /faq now have content.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
