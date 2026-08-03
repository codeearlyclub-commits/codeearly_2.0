/**
 * Content surfaces: blog, showcase, events, newsletter, enquiries.
 *
 * The failures worth catching here are not crashes. They are:
 *
 *   - a child's project going public without recorded parental consent
 *   - a published post's URL moving because someone fixed a typo in the title
 *   - an event overselling under simultaneous bookings
 *   - someone who unsubscribed quietly reappearing on the list
 *   - a draft showing on a public page
 *
 * Each of those is silent, and each is embarrassing in a different way. So they
 * are asserted by RUNNING them, including the concurrency case, rather than by
 * reading the code and believing it.
 *
 *   npx tsx scripts/check-content.ts
 *
 * Destructive: creates and removes its own fixtures. Local and CI only.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { isAppError } from "@/lib/errors";
import {
  savePost,
  getPublicPost,
  listPublicPosts,
  deletePost,
  saveShowcase,
  listPublicShowcase,
  deleteShowcase,
  saveEvent,
  rsvpToEvent,
  listPublicEvents,
  deleteEvent,
  subscribeToNewsletter,
  unsubscribeByToken,
  activeSubscribers,
  storeMessage,
  setMessageStatus,
  listMessages,
} from "@/server/content/content";

const MARK = "content-check";

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

async function cleanup() {
  await prisma.blogPost.deleteMany({ where: { author: MARK } });
  await prisma.showcaseProject.deleteMany({ where: { childFirstName: { startsWith: "Zz" } } });
  await prisma.event.deleteMany({ where: { title: { startsWith: MARK } } });
  await prisma.newsletterSubscriber.deleteMany({ where: { email: { contains: MARK } } });
  await prisma.contactMessage.deleteMany({ where: { email: { contains: MARK } } });
}

async function main() {
  await cleanup();

  // ── Blog ───────────────────────────────────────────────────────────────────
  console.log("\nBlog");

  const post = await savePost({
    title: "Teaching a seven year old to debug",
    excerpt: "It is mostly about staying calm.",
    author: MARK,
    coverUrl: null,
    tags: ["Parents", "Scratch"],
    status: "PUBLISHED",
    blocks: [
      { kind: "HEADING", text: "Start with the error" },
      { kind: "TEXT", text: "Read it together.\n\nOut loud." },
    ],
  });
  check("publishing sets publishedAt", post.publishedAt !== null);

  const originalSlug = post.slug;
  const originalPublishedAt = post.publishedAt;

  const renamed = await savePost(
    {
      title: "Teaching a seven-year-old to debug",
      excerpt: "It is mostly about staying calm.",
      author: MARK,
      coverUrl: null,
      tags: ["Parents"],
      status: "PUBLISHED",
      blocks: [{ kind: "TEXT", text: "Read it together." }],
    },
    post.id
  );
  check(
    "a live post's URL does not move when the title is edited",
    renamed.slug === originalSlug,
    renamed.slug
  );
  check(
    "publishedAt is the original date, not the edit date",
    renamed.publishedAt?.getTime() === originalPublishedAt?.getTime()
  );

  const reloaded = await getPublicPost(originalSlug);
  check("blocks are replaced, not appended", reloaded.blocks.length === 1);

  const draft = await savePost({
    title: "A draft nobody should see",
    excerpt: null,
    author: MARK,
    coverUrl: null,
    tags: [],
    status: "DRAFT",
    blocks: [{ kind: "TEXT", text: "unfinished" }],
  });
  const publicPosts = await listPublicPosts();
  check(
    "drafts are absent from the public list",
    !publicPosts.some((p) => p.id === draft.id)
  );
  await refuses("a draft cannot be fetched by URL", () => getPublicPost(draft.slug));

  await refuses("publishing with no content is refused", () =>
    savePost({
      title: "Empty but published",
      excerpt: null,
      author: MARK,
      coverUrl: null,
      tags: [],
      status: "PUBLISHED",
      blocks: [],
    })
  );

  await deletePost(post.id);
  await deletePost(draft.id);
  check(
    "deleting a post removes its blocks",
    (await prisma.blogBlock.count({ where: { postId: post.id } })) === 0
  );

  // ── Showcase ───────────────────────────────────────────────────────────────
  console.log("\nShowcase — safeguarding");

  await refuses("publishing without recorded consent is refused", () =>
    saveShowcase({
      title: "A maze game",
      description: null,
      childFirstName: "Zzada",
      childAge: 9,
      mediaUrl: null,
      projectUrl: null,
      tags: [],
      featured: false,
      status: "PUBLISHED",
      consentBy: null,
    })
  );

  await refuses("a full name is refused", () =>
    saveShowcase({
      title: "A maze game",
      description: null,
      childFirstName: "Zzada Okonkwo",
      childAge: 9,
      mediaUrl: null,
      projectUrl: null,
      tags: [],
      featured: false,
      status: "DRAFT",
      consentBy: null,
    })
  );

  const project = await saveShowcase({
    title: "A maze game",
    description: "Built in Scratch over two Saturdays.",
    childFirstName: "Zzada",
    childAge: 9,
    mediaUrl: null,
    projectUrl: null,
    tags: ["Scratch"],
    featured: false,
    status: "DRAFT",
    consentBy: null,
  });
  check("an unconsented entry can still be drafted", project.status === "DRAFT");

  const publicBefore = await listPublicShowcase();
  check(
    "a draft project is not public",
    !publicBefore.some((p) => p.id === project.id)
  );

  // The database is the backstop. Bypass the service entirely and confirm the
  // CHECK constraint refuses it too — a future caller that forgets the rule must
  // not be able to publish a child's project.
  let dbRefused = false;
  try {
    await prisma.showcaseProject.update({
      where: { id: project.id },
      data: { status: "PUBLISHED" },
    });
  } catch {
    dbRefused = true;
  }
  check("the DATABASE also refuses publishing without consent", dbRefused);

  const consented = await saveShowcase(
    {
      title: "A maze game",
      description: "Built in Scratch over two Saturdays.",
      childFirstName: "Zzada",
      childAge: 9,
      mediaUrl: null,
      projectUrl: null,
      tags: ["Scratch"],
      featured: true,
      status: "PUBLISHED",
      consentBy: "Mrs Okonkwo, by email 2026-07-02",
    },
    project.id
  );
  check("consent stamps a date", consented.consentGivenAt !== null);
  check("consented projects publish", consented.status === "PUBLISHED");

  await deleteShowcase(project.id);

  // ── Events ─────────────────────────────────────────────────────────────────
  console.log("\nEvents — capacity");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const event = await saveEvent({
    title: `${MARK} open day`,
    description: "Come and see.",
    startsAt: tomorrow.toISOString(),
    endsAt: null,
    location: "Lagos",
    virtualLink: null,
    capacity: 3,
    status: "PUBLISHED",
  });

  // Six people book at the same instant against three places. Counting first and
  // inserting after would let all six through; the conditional UPDATE must not.
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      rsvpToEvent({
        slug: event.slug,
        name: `Parent ${i}`,
        email: `${MARK}-${i}@example.com`,
        phone: null,
        guests: 1,
      })
    )
  );
  const booked = attempts.filter((a) => a.status === "fulfilled").length;
  const rows = await prisma.eventRsvp.count({ where: { eventId: event.id } });
  const seats = (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).seatsTaken;

  check("exactly capacity many bookings succeed", booked === 3, `${booked} succeeded`);
  check("no extra RSVP rows exist", rows === 3, `${rows} rows`);
  check("seatsTaken matches the rows", seats === 3, `seatsTaken=${seats}`);

  // Which three won the race is genuinely non-deterministic, so re-book one of
  // the RSVPs that actually exists rather than assuming it was the first email.
  const winner = await prisma.eventRsvp.findFirstOrThrow({ where: { eventId: event.id } });
  const again = await rsvpToEvent({
    slug: event.slug,
    name: winner.name,
    email: winner.email,
    phone: null,
    guests: 1,
  });
  check("re-booking the same email is reported, not duplicated", again.alreadyBooked);
  check(
    "re-booking does not consume another place",
    (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).seatsTaken === 3
  );

  await refuses("a full event refuses a new booking", () =>
    rsvpToEvent({
      slug: event.slug,
      name: "Latecomer",
      email: `${MARK}-late@example.com`,
      phone: null,
      guests: 1,
    })
  );

  await refuses("capacity cannot drop below the places already taken", () =>
    saveEvent(
      {
        title: `${MARK} open day`,
        description: null,
        startsAt: tomorrow.toISOString(),
        endsAt: null,
        location: "Lagos",
        virtualLink: null,
        capacity: 1,
        status: "PUBLISHED",
      },
      event.id
    )
  );

  await refuses("an event with bookings cannot be deleted", () => deleteEvent(event.id));

  // Capacity counts PEOPLE. An open day advertised as 10 places must not admit
  // ten parties of four.
  const party = await saveEvent({
    title: `${MARK} party test`,
    description: null,
    startsAt: tomorrow.toISOString(),
    endsAt: null,
    location: "Lagos",
    virtualLink: null,
    capacity: 10,
    status: "PUBLISHED",
  });

  await rsvpToEvent({
    slug: party.slug,
    name: "Family of four",
    email: `${MARK}-four@example.com`,
    phone: null,
    guests: 4,
  });
  check(
    "a party of four consumes four places",
    (await prisma.event.findUniqueOrThrow({ where: { id: party.id } })).seatsTaken === 4
  );

  await rsvpToEvent({
    slug: party.slug,
    name: "Family of five",
    email: `${MARK}-five@example.com`,
    phone: null,
    guests: 5,
  });
  await refuses("a party that would not fit is refused", () =>
    rsvpToEvent({
      slug: party.slug,
      name: "Family of three",
      email: `${MARK}-three@example.com`,
      phone: null,
      guests: 3,
    })
  );
  check(
    "a refused party leaves the count untouched",
    (await prisma.event.findUniqueOrThrow({ where: { id: party.id } })).seatsTaken === 9
  );

  // The last place is still bookable by someone who fits.
  await rsvpToEvent({
    slug: party.slug,
    name: "One more",
    email: `${MARK}-one@example.com`,
    phone: null,
    guests: 1,
  });
  const partyFinal = await prisma.event.findUniqueOrThrow({ where: { id: party.id } });
  check("the event fills exactly to capacity", partyFinal.seatsTaken === 10);
  check(
    "seatsTaken equals the people actually booked",
    (
      await prisma.eventRsvp.aggregate({
        where: { eventId: party.id },
        _sum: { guests: true },
      })
    )._sum.guests === partyFinal.seatsTaken
  );

  await refuses("a party larger than the whole event is refused", () =>
    rsvpToEvent({
      slug: party.slug,
      name: "Coach party",
      email: `${MARK}-coach@example.com`,
      phone: null,
      guests: 20,
    })
  );

  const pastEvent = await saveEvent({
    title: `${MARK} last month`,
    description: null,
    startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endsAt: null,
    location: null,
    virtualLink: null,
    capacity: null,
    status: "PUBLISHED",
  });
  const upcoming = await listPublicEvents();
  check(
    "past events are absent from the public list",
    !upcoming.some((e) => e.id === pastEvent.id)
  );
  await refuses("a past event refuses bookings", () =>
    rsvpToEvent({
      slug: pastEvent.slug,
      name: "Time traveller",
      email: `${MARK}-past@example.com`,
      phone: null,
      guests: 1,
    })
  );

  await refuses("an event ending before it starts is refused", () =>
    saveEvent({
      title: `${MARK} impossible`,
      description: null,
      startsAt: tomorrow.toISOString(),
      endsAt: new Date(Date.now() - 1000).toISOString(),
      location: null,
      virtualLink: null,
      capacity: null,
      status: "DRAFT",
    })
  );

  // ── Newsletter ─────────────────────────────────────────────────────────────
  console.log("\nNewsletter");

  const email = `${MARK}-news@example.com`;
  const sub = await subscribeToNewsletter(email, "Parent");
  const dupe = await subscribeToNewsletter(email, "Parent");
  check("subscribing twice does not duplicate", sub.id === dupe.id);
  check("a token is issued", sub.unsubscribeToken.length > 10);

  await unsubscribeByToken(sub.unsubscribeToken);
  const afterLeave = await activeSubscribers();
  check(
    "an unsubscribed address is off the sending list",
    !afterLeave.some((s) => s.email === email)
  );

  const secondClick = await unsubscribeByToken(sub.unsubscribeToken);
  check("clicking unsubscribe twice is harmless", secondClick.unsubscribedAt !== null);

  const stillThere = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  check("the row survives, so a re-import cannot resurrect them", stillThere !== null);

  await subscribeToNewsletter(email);
  const afterReturn = await activeSubscribers();
  check(
    "someone who asks again is reactivated",
    afterReturn.some((s) => s.email === email)
  );

  await refuses("a malformed address is refused", () => subscribeToNewsletter("not-an-email"));
  await refuses("an unknown token is refused", () => unsubscribeByToken("nonsense-token-value"));

  // ── Enquiries ──────────────────────────────────────────────────────────────
  console.log("\nEnquiries");

  const message = await storeMessage({
    name: "Worried Parent",
    email: `${MARK}-ask@example.com`,
    phone: null,
    message: "Do you run Saturday classes in Abuja?",
    ipHash: "deadbeef",
  });
  check("an enquiry starts as NEW", message.status === "NEW");
  check("handledAt is empty until someone acts", message.handledAt === null);

  const handled = await setMessageStatus(message.id, "REPLIED", "staff@codeearly.com");
  check("replying stamps who and when", handled.handledAt !== null && handled.handledBy !== null);

  const reopened = await setMessageStatus(message.id, "NEW");
  check("reopening clears the handled stamp", reopened.handledAt === null);

  const newOnes = await listMessages("NEW");
  check("filtering by status works", newOnes.some((m) => m.id === message.id));

  await cleanup();

  console.log(
    failures === 0
      ? "\n✅ content surfaces behave"
      : `\n❌ ${failures} content check(s) failed`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  process.exit(1);
});
