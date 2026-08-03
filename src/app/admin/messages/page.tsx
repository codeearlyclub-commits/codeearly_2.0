/**
 * Enquiries — staff view.
 *
 * Filtering is a URL parameter so "show me everything still unanswered" is a
 * link someone can bookmark.
 */
import Link from "next/link";

import { listMessages } from "@/server/content/content";
import { MessagesAdmin } from "./MessagesAdmin";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "READ", "REPLIED", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as Status) ? (status as Status) : undefined;

  const messages = await listMessages(filter);

  return (
    <>
      <header className="admin__head">
        <h1>Enquiries</h1>
        <p className="muted">
          Every message from the contact form, stored — so one lost in an inbox is
          still here.
        </p>
      </header>

      <div className="admin__filters">
        <Link href="/admin/messages" className={filter ? "" : "is-active"}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/messages?status=${s}`}
            className={filter === s ? "is-active" : ""}
          >
            {s}
          </Link>
        ))}
      </div>

      <MessagesAdmin
        messages={messages.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          message: m.message,
          status: m.status,
          createdAt: dateFmt.format(m.createdAt),
          handledAt: m.handledAt ? dateFmt.format(m.handledAt) : null,
          handledBy: m.handledBy,
        }))}
      />
    </>
  );
}
