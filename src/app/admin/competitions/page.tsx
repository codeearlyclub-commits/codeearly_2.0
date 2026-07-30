import { listCompetitions } from "@/server/quiz/admin";
import { CompetitionsAdmin } from "./CompetitionsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCompetitionsPage() {
  const competitions = await listCompetitions();

  return (
    <>
      <header className="admin__head">
        <h1>Quizzes</h1>
        <p className="muted">
          A quiz that has already been played cannot be edited — its questions are
          part of the results. Duplicate it to run a revised version.
        </p>
      </header>

      <CompetitionsAdmin
        initial={competitions.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          type: c.type,
          status: c.status,
          visibility: c.visibility,
          sessions: c._count.sessions,
          questions: c.questions.map((q) => ({
            text: q.text,
            options: q.options,
            correctAnswer: q.correctAnswer,
            timeLimitSeconds: q.timeLimitSeconds,
          })),
        }))}
      />
    </>
  );
}
