/**
 * Host console — the screen the teacher drives, usually on a projector.
 *
 * Deliberately its own full-width route rather than a panel inside the admin
 * shell: during a live quiz the nav is noise, and the room is looking at this.
 */
import { notFound } from "next/navigation";

import "@/styles/quiz.css";
import { prisma } from "@/lib/prisma";
import { HostConsole } from "./HostConsole";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function HostPage({ params }: Props) {
  const { id } = await params;

  const competition = await prisma.competition.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, select: { id: true } },
      sessions: {
        where: { phase: { not: "ENDED" } },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, joinCode: true, phase: true },
      },
    },
  });
  if (!competition) notFound();

  return (
    <HostConsole
      competitionId={competition.id}
      title={competition.title}
      visibility={competition.visibility}
      questionCount={competition.questions.length}
      // Resuming matters: if the host's laptop dies mid-quiz, reopening this
      // page must rejoin the room that is still running rather than start a
      // second one in front of the same children.
      existing={competition.sessions[0] ?? null}
    />
  );
}
