/**
 * Authoring quizzes — competitions and their questions.
 *
 * Questions are replaced wholesale on save rather than diffed. A question set is
 * edited as a single document, and a half-applied edit is worse than a rewritten
 * one. The exception is a competition with finished sessions: those questions are
 * referenced by results and answers, so editing them would retroactively change
 * what a child was asked. That is refused.
 */
import type { Competition, QuizVisibility } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { errors } from "@/lib/errors";
import { SYSTEM_ORG_ID } from "@/lib/constants";
import { effectiveLimits } from "@/server/orgs/entitlements";

export type QuestionInput = {
  text: string;
  options: string[];
  correctAnswer: string;
  timeLimitSeconds: number;
};

export type CompetitionInput = {
  title: string;
  description?: string | null;
  type: string;
  status: string;
  visibility: QuizVisibility;
  questions: QuestionInput[];
};

export async function listCompetitions(organizationId = SYSTEM_ORG_ID) {
  return prisma.competition.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { sessions: true } },
    },
  });
}

function validate(input: CompetitionInput, maxQuestions: number) {
  if (input.title.trim().length < 3) {
    throw errors.validation("A quiz needs a title of at least 3 characters.");
  }
  if (input.questions.length === 0) {
    throw errors.validation("A quiz needs at least one question.");
  }
  if (input.questions.length > maxQuestions) {
    throw errors.planLimit(
      `Your plan allows ${maxQuestions} questions per quiz. Upgrade to add more.`
    );
  }

  input.questions.forEach((question, i) => {
    const where = `Question ${i + 1}`;

    if (question.text.trim().length < 3) {
      throw errors.validation(`${where} needs some text.`);
    }

    const options = question.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw errors.validation(`${where} needs at least two options.`);
    }

    // Duplicate options make the reveal ambiguous — two identical buttons, one
    // of them "correct", and a child who tapped the other one is rightly cross.
    if (new Set(options).size !== options.length) {
      throw errors.validation(`${where} has duplicate options.`);
    }

    // The single most damaging authoring mistake: a correct answer that is not
    // among the options means nobody can ever score, and it is invisible until
    // the quiz is live in front of a room.
    if (!options.includes(question.correctAnswer.trim())) {
      throw errors.validation(`${where}'s correct answer must be one of its options.`);
    }

    if (question.timeLimitSeconds < 5 || question.timeLimitSeconds > 300) {
      throw errors.validation(`${where}'s time limit must be between 5 and 300 seconds.`);
    }
  });
}

async function limitsFor(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw errors.notFound("Organisation not found.");
  return effectiveLimits(org);
}

export async function createCompetition(
  input: CompetitionInput,
  organizationId = SYSTEM_ORG_ID
): Promise<Competition> {
  const limits = await limitsFor(organizationId);
  validate(input, limits.maxQuestionsPerQuiz);

  return prisma.$transaction(async (tx) => {
    const competition = await tx.competition.create({
      data: {
        organizationId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        status: input.status,
        visibility: input.visibility,
      },
    });

    await tx.quizQuestion.createMany({
      data: input.questions.map((q, i) => ({
        competitionId: competition.id,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correctAnswer: q.correctAnswer.trim(),
        timeLimitSeconds: q.timeLimitSeconds,
        order: i,
      })),
    });

    return competition;
  });
}

export async function updateCompetition(
  id: string,
  input: CompetitionInput
): Promise<Competition> {
  const existing = await prisma.competition.findUnique({
    where: { id },
    include: { _count: { select: { sessions: true } } },
  });
  if (!existing) throw errors.notFound("Quiz not found.");

  const limits = await limitsFor(existing.organizationId);
  validate(input, limits.maxQuestionsPerQuiz);

  // Once a quiz has been played, its questions are part of the record: results
  // and stored answers reference them. Rewriting them would change what a child
  // was asked after the fact.
  if (existing._count.sessions > 0) {
    throw errors.conflict(
      "This quiz has already been played, so its questions are part of the results and cannot be edited. Duplicate it instead."
    );
  }

  return prisma.$transaction(async (tx) => {
    const competition = await tx.competition.update({
      where: { id },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        status: input.status,
        visibility: input.visibility,
      },
    });

    await tx.quizQuestion.deleteMany({ where: { competitionId: id } });
    await tx.quizQuestion.createMany({
      data: input.questions.map((q, i) => ({
        competitionId: id,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()).filter(Boolean),
        correctAnswer: q.correctAnswer.trim(),
        timeLimitSeconds: q.timeLimitSeconds,
        order: i,
      })),
    });

    return competition;
  });
}

/**
 * Copy a quiz and its questions.
 *
 * This is the answer to "this quiz has been played and cannot be edited" — run
 * it again next term with a tweak, without touching the record of what happened
 * the first time.
 */
export async function duplicateCompetition(id: string): Promise<Competition> {
  const source = await prisma.competition.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!source) throw errors.notFound("Quiz not found.");

  return prisma.$transaction(async (tx) => {
    const copy = await tx.competition.create({
      data: {
        organizationId: source.organizationId,
        title: `${source.title} (copy)`,
        description: source.description,
        type: source.type,
        // A copy always starts unpublished, so duplicating cannot accidentally
        // put a second live quiz in front of people.
        status: "upcoming",
        visibility: source.visibility,
      },
    });

    await tx.quizQuestion.createMany({
      data: source.questions.map((q, i) => ({
        competitionId: copy.id,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        timeLimitSeconds: q.timeLimitSeconds,
        order: i,
      })),
    });

    return copy;
  });
}

/** Delete a quiz that has never been played; refuse otherwise. */
export async function removeCompetition(id: string): Promise<void> {
  const played = await prisma.quizSession.count({ where: { competitionId: id } });
  if (played > 0) {
    throw errors.conflict(
      "This quiz has been played. Deleting it would remove the results too — archive it instead."
    );
  }
  await prisma.competition.delete({ where: { id } });
}
