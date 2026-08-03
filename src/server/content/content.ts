/**
 * Content surfaces: blog, showcase, events, testimonials, FAQs, newsletter and
 * enquiries.
 *
 * One module because they share a shape — publishable, ordered, public-facing —
 * and keeping them together means one set of rules rather than seven slightly
 * different ones.
 *
 * The rule that runs through all of it: the PUBLIC readers here return published
 * records only, and they are the only functions a public page is allowed to call.
 * Admin readers live alongside them and see everything.
 */
import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { slugify } from "@/lib/ids";
import { logger } from "@/lib/logger";

/** Allocate a slug unique within a table. */
async function uniqueSlug(
  title: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(title) || "item";
  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await exists(slug))) return slug;
  }
  throw errors.internal("Could not allocate a unique URL.");
}

// ── Blog ─────────────────────────────────────────────────────────────────────

export async function listPublicPosts({
  q,
  tag,
  take = 30,
}: { q?: string; tag?: string; take?: number } = {}) {
  return prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      ...(tag ? { tags: { has: tag } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { excerpt: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { publishedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      author: true,
      coverUrl: true,
      tags: true,
      publishedAt: true,
    },
  });
}

/** Every tag in use on a published post, for the archive's filter row. */
export async function listPublicTags(): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { tags: true },
  });
  return [...new Set(posts.flatMap((p) => p.tags))].sort();
}

export async function getPublicPost(slug: string) {
  const post = await prisma.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!post) throw errors.notFound("Post not found.");
  return post;
}

export async function listAllPosts() {
  return prisma.blogPost.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      author: true,
      tags: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { blocks: true } },
    },
  });
}

export async function getPostForEdit(id: string) {
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!post) throw errors.notFound("Post not found.");
  return post;
}

export type PostInput = {
  title: string;
  excerpt?: string | null;
  author: string;
  coverUrl?: string | null;
  tags: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  blocks: Array<{ kind: string; text: string; meta?: string | null }>;
};

export async function savePost(input: PostInput, id?: string) {
  if (input.title.trim().length < 3) throw errors.validation("A post needs a title.");
  if (input.status === "PUBLISHED" && input.blocks.length === 0) {
    throw errors.validation("A published post needs some content.");
  }

  const existing = id ? await prisma.blogPost.findUnique({ where: { id } }) : null;
  if (id && !existing) throw errors.notFound("Post not found.");

  // A published post's URL stops moving: it may already be shared or indexed.
  const slug =
    existing && existing.status === "PUBLISHED"
      ? existing.slug
      : await uniqueSlug(input.title, async (s) => {
          const clash = await prisma.blogPost.findFirst({
            where: { slug: s, ...(id ? { id: { not: id } } : {}) },
            select: { id: true },
          });
          return clash !== null;
        });

  const data = {
    title: input.title.trim(),
    slug,
    excerpt: input.excerpt?.trim() || null,
    author: input.author.trim() || "CodeEarly Team",
    coverUrl: input.coverUrl?.trim() || null,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    status: input.status,
    // Set once, on first publication, and kept — it is the date readers cite.
    publishedAt:
      input.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
  };

  return prisma.$transaction(async (tx) => {
    const post = existing
      ? await tx.blogPost.update({ where: { id: existing.id }, data })
      : await tx.blogPost.create({ data });

    await tx.blogBlock.deleteMany({ where: { postId: post.id } });
    if (input.blocks.length > 0) {
      await tx.blogBlock.createMany({
        data: input.blocks
          .filter((b) => b.text.trim())
          .map((b, i) => ({
            postId: post.id,
            kind: b.kind as never,
            text: b.text.trim(),
            meta: b.meta?.trim() || null,
            order: i,
          })),
      });
    }
    return post;
  });
}

export async function deletePost(id: string) {
  await prisma.blogPost.delete({ where: { id } });
}

// ── Showcase ─────────────────────────────────────────────────────────────────

export async function listPublicShowcase(take = 60) {
  return prisma.showcaseProject.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function listAllShowcase() {
  return prisma.showcaseProject.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export type ShowcaseInput = {
  title: string;
  description?: string | null;
  childFirstName: string;
  childAge?: number | null;
  mediaUrl?: string | null;
  projectUrl?: string | null;
  tags: string[];
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  consentBy?: string | null;
};

/**
 * Save a showcase entry.
 *
 * Publishing REQUIRES recorded parental consent. This is a public page about a
 * child, so consent is not something to remember — it is refused here and again
 * by a CHECK constraint in the database.
 */
export async function saveShowcase(input: ShowcaseInput, id?: string) {
  if (input.title.trim().length < 3) throw errors.validation("A project needs a title.");
  if (!input.childFirstName.trim()) throw errors.validation("A first name is required.");

  // Guard against a full name being pasted into a public field.
  if (input.childFirstName.trim().includes(" ")) {
    throw errors.validation(
      "First name only — a showcase page must never carry a child's full name."
    );
  }

  if (input.status === "PUBLISHED" && !input.consentBy?.trim()) {
    throw errors.validation(
      "Record who gave parental consent before publishing a child's project."
    );
  }

  const existing = id ? await prisma.showcaseProject.findUnique({ where: { id } }) : null;
  if (id && !existing) throw errors.notFound("Project not found.");

  const slug =
    existing?.slug ??
    (await uniqueSlug(input.title, async (s) => {
      const clash = await prisma.showcaseProject.findFirst({ where: { slug: s }, select: { id: true } });
      return clash !== null;
    }));

  const consenting = input.consentBy?.trim() || null;

  const data = {
    title: input.title.trim(),
    slug,
    description: input.description?.trim() || null,
    childFirstName: input.childFirstName.trim(),
    childAge: input.childAge ?? null,
    mediaUrl: input.mediaUrl?.trim() || null,
    projectUrl: input.projectUrl?.trim() || null,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    featured: input.featured,
    status: input.status,
    consentBy: consenting,
    // Stamped when consent is first recorded, and kept.
    consentGivenAt: consenting ? (existing?.consentGivenAt ?? new Date()) : null,
  };

  return existing
    ? prisma.showcaseProject.update({ where: { id: existing.id }, data })
    : prisma.showcaseProject.create({ data });
}

export async function deleteShowcase(id: string) {
  await prisma.showcaseProject.delete({ where: { id } });
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function listPublicEvents() {
  return prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { rsvps: true } } },
  });
}

export async function getPublicEvent(slug: string) {
  const event = await prisma.event.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { _count: { select: { rsvps: true } } },
  });
  if (!event) throw errors.notFound("Event not found.");
  return event;
}

/**
 * RSVP to an event.
 *
 * Capacity is claimed with the same atomic conditional UPDATE that programs use —
 * a count-then-insert lets simultaneous RSVPs both pass. Re-submitting the same
 * email returns the existing RSVP rather than erroring, because a double-tap is a
 * mis-click, not a second family.
 *
 * CAPACITY COUNTS PEOPLE, NOT BOOKINGS. A parent booking for four consumes four
 * places. Counting bookings instead would let an open day advertised as "40
 * places" fill a room with a hundred and sixty people, which is a fire-safety
 * problem rather than a rounding error.
 */
export async function rsvpToEvent(input: {
  slug: string;
  name: string;
  email: string;
  phone?: string | null;
  guests: number;
}) {
  const event = await prisma.event.findFirst({
    where: { slug: input.slug, status: "PUBLISHED" },
  });
  if (!event) throw errors.notFound("Event not found.");
  if (event.startsAt < new Date()) throw errors.conflict("That event has already happened.");

  // Clamped before it is used for anything, so the number written to the row and
  // the number of places claimed can never disagree.
  const guests = Math.min(Math.max(1, Math.trunc(input.guests) || 1), 20);

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.eventRsvp.findUnique({
    where: { eventId_email: { eventId: event.id, email } },
  });
  if (existing) return { rsvp: existing, alreadyBooked: true };

  if (event.capacity !== null) {
    if (guests > event.capacity) {
      throw errors.conflict(`This event only has ${event.capacity} places in total.`);
    }
    const claimed = await prisma.event.updateMany({
      where: { id: event.id, seatsTaken: { lte: event.capacity - guests } },
      data: { seatsTaken: { increment: guests } },
    });
    if (claimed.count === 0) {
      const left = Math.max(0, event.capacity - event.seatsTaken);
      throw errors.conflict(
        left === 0
          ? "This event is fully booked."
          : `Only ${left} place${left === 1 ? "" : "s"} left — try a smaller party.`
      );
    }
  }

  try {
    const rsvp = await prisma.eventRsvp.create({
      data: {
        eventId: event.id,
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        guests,
      },
    });
    return { rsvp, alreadyBooked: false };
  } catch (err) {
    // Hand the places back, or the event silently shrinks every time this
    // happens.
    if (event.capacity !== null) {
      await prisma.event.update({
        where: { id: event.id },
        data: { seatsTaken: { decrement: guests } },
      });
    }
    throw err;
  }
}

export async function listAllEvents() {
  return prisma.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { rsvps: true } } },
  });
}

export async function getEventWithRsvps(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { rsvps: { orderBy: { createdAt: "asc" } } },
  });
  if (!event) throw errors.notFound("Event not found.");
  return event;
}

export type EventInput = {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  virtualLink?: string | null;
  capacity?: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export async function saveEvent(input: EventInput, id?: string) {
  if (input.title.trim().length < 3) throw errors.validation("An event needs a title.");

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw errors.validation("That start date isn't valid.");

  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (endsAt && endsAt < startsAt) throw errors.validation("An event cannot end before it starts.");

  const existing = id ? await prisma.event.findUnique({ where: { id } }) : null;
  if (id && !existing) throw errors.notFound("Event not found.");

  // Refused here so staff see a sentence, not a CHECK-constraint violation. The
  // constraint stays as the backstop.
  if (input.capacity !== null && input.capacity !== undefined && existing) {
    if (input.capacity < existing.seatsTaken) {
      throw errors.validation(
        `${existing.seatsTaken} people have already booked — capacity cannot go below that.`
      );
    }
  }

  const slug =
    existing?.slug ??
    (await uniqueSlug(input.title, async (s) => {
      const clash = await prisma.event.findFirst({ where: { slug: s }, select: { id: true } });
      return clash !== null;
    }));

  const data = {
    title: input.title.trim(),
    slug,
    description: input.description?.trim() || null,
    startsAt,
    endsAt,
    location: input.location?.trim() || null,
    virtualLink: input.virtualLink?.trim() || null,
    capacity: input.capacity ?? null,
    status: input.status,
  };

  return existing
    ? prisma.event.update({ where: { id: existing.id }, data })
    : prisma.event.create({ data });
}

/**
 * Delete an event. Refused once anyone has booked — those people are expecting
 * to turn up somewhere, and the RSVPs would cascade away with it. Archive
 * instead.
 */
export async function deleteEvent(id: string) {
  const count = await prisma.eventRsvp.count({ where: { eventId: id } });
  if (count > 0) {
    throw errors.conflict(
      `${count} ${count === 1 ? "person has" : "people have"} booked this event. Archive it instead of deleting it.`
    );
  }
  await prisma.event.delete({ where: { id } });
}

// ── Testimonials and FAQs ────────────────────────────────────────────────────

export async function listPublicTestimonials() {
  return prisma.testimonial.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { order: "asc" },
  });
}

export async function listPublicFaqs() {
  return prisma.faq.findMany({ where: { status: "PUBLISHED" }, orderBy: { order: "asc" } });
}

export async function listAllTestimonials() {
  return prisma.testimonial.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] });
}

export async function listAllFaqs() {
  return prisma.faq.findMany({ orderBy: [{ order: "asc" }, { question: "asc" }] });
}

export type TestimonialInput = {
  quote: string;
  author: string;
  role?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order: number;
};

export async function saveTestimonial(input: TestimonialInput, id?: string) {
  if (input.quote.trim().length < 10) throw errors.validation("That quote is too short.");
  if (!input.author.trim()) throw errors.validation("A testimonial needs an attribution.");

  const data = {
    quote: input.quote.trim(),
    author: input.author.trim(),
    role: input.role?.trim() || null,
    status: input.status,
    order: input.order,
  };

  return id
    ? prisma.testimonial.update({ where: { id }, data })
    : prisma.testimonial.create({ data });
}

export async function deleteTestimonial(id: string) {
  await prisma.testimonial.delete({ where: { id } });
}

export type FaqInput = {
  question: string;
  answer: string;
  category?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  order: number;
};

export async function saveFaq(input: FaqInput, id?: string) {
  if (input.question.trim().length < 5) throw errors.validation("That question is too short.");
  if (input.answer.trim().length < 5) throw errors.validation("That answer is too short.");

  const data = {
    question: input.question.trim(),
    answer: input.answer.trim(),
    category: input.category?.trim() || null,
    status: input.status,
    order: input.order,
  };

  return id ? prisma.faq.update({ where: { id }, data }) : prisma.faq.create({ data });
}

export async function deleteFaq(id: string) {
  await prisma.faq.delete({ where: { id } });
}

// ── Newsletter ───────────────────────────────────────────────────────────────

/**
 * Subscribe an address.
 *
 * Re-subscribing an address that previously unsubscribed reactivates it, which is
 * correct — they asked again. But the row is never deleted, so a re-import can
 * never resurrect someone who asked us to stop.
 */
export async function subscribeToNewsletter(email: string, name?: string | null) {
  const address = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw errors.validation("That email address doesn't look right.");
  }

  const token = randomBytes(24).toString("base64url");

  return prisma.newsletterSubscriber.upsert({
    where: { email: address },
    create: { email: address, name: name?.trim() || null, unsubscribeToken: token },
    update: { unsubscribedAt: null, name: name?.trim() || undefined },
  });
}

/** Unsubscribe by token. Idempotent — a second click must not error. */
export async function unsubscribeByToken(token: string) {
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: token },
  });
  if (!subscriber) throw errors.notFound("That unsubscribe link is not valid.");

  if (subscriber.unsubscribedAt) return subscriber;

  return prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: new Date() },
  });
}

/** Everyone who should receive a mailing. */
export async function activeSubscribers() {
  return prisma.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null },
    select: { email: true, name: true, unsubscribeToken: true },
  });
}

/** Admin view — includes people who have unsubscribed, so the count is honest. */
export async function listSubscribers() {
  return prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

// ── Enquiries ────────────────────────────────────────────────────────────────

/**
 * Store a contact enquiry.
 *
 * V4 emailed these and kept nothing, so an enquiry lost in an inbox was lost
 * entirely. Storing them means none is silently dropped, and staff can see what
 * has not been answered yet.
 */
export async function storeMessage(input: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  ipHash?: string | null;
}) {
  const message = await prisma.contactMessage.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      message: input.message.trim(),
      ipHash: input.ipHash ?? null,
    },
  });
  logger.info({ id: message.id, from: message.email }, "enquiry stored");
  return message;
}

export async function listMessages(status?: "NEW" | "READ" | "REPLIED" | "ARCHIVED") {
  return prisma.contactMessage.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function setMessageStatus(
  id: string,
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED",
  handledBy?: string
) {
  return prisma.contactMessage.update({
    where: { id },
    data: {
      status,
      handledAt: status === "NEW" ? null : new Date(),
      handledBy: status === "NEW" ? null : (handledBy ?? null),
    },
  });
}
