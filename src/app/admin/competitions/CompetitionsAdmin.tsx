"use client";

/**
 * Quiz authoring.
 *
 * The correct answer is chosen by RADIO from the options rather than typed. A
 * free-text correct answer that does not match any option is the single most
 * damaging authoring mistake — nobody can score, and it is invisible until the
 * quiz is live in front of a room. Making it a choice removes the failure mode
 * rather than validating it after the fact.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  text: string;
  options: string[];
  correctAnswer: string;
  timeLimitSeconds: number;
};

type Competition = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  visibility: "MEMBERS" | "UNLISTED" | "PUBLIC";
  sessions: number;
  questions: Question[];
};

type Draft = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  visibility: Competition["visibility"];
  questions: Question[];
};

const BLANK_QUESTION: Question = {
  text: "",
  options: ["", ""],
  correctAnswer: "",
  timeLimitSeconds: 30,
};

const BLANK: Draft = {
  id: "",
  title: "",
  description: "",
  type: "quiz",
  status: "upcoming",
  visibility: "MEMBERS",
  questions: [{ ...BLANK_QUESTION, options: ["", ""] }],
};

export function CompetitionsAdmin({ initial }: { initial: Competition[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(c: Competition) {
    setError(null);
    setEditing({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      type: c.type,
      status: c.status,
      visibility: c.visibility,
      questions: c.questions.map((q) => ({ ...q, options: [...q.options] })),
    });
  }

  function patchQuestion(i: number, patch: Partial<Question>) {
    if (!editing) return;
    setEditing({
      ...editing,
      questions: editing.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    });
  }

  function setOption(qi: number, oi: number, value: string) {
    if (!editing) return;
    const question = editing.questions[qi]!;
    const options = question.options.map((o, idx) => (idx === oi ? value : o));
    // If the option that was marked correct is renamed, follow it rather than
    // silently losing the answer.
    const correctAnswer =
      question.correctAnswer === question.options[oi] ? value : question.correctAnswer;
    patchQuestion(qi, { options, correctAnswer });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);

    // Caught client-side too, because the server error names a question number
    // and it is friendlier to point at the field before submitting.
    for (const [i, q] of editing.questions.entries()) {
      const filled = q.options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) {
        setError(`Question ${i + 1} needs at least two options.`);
        return;
      }
      if (!q.correctAnswer.trim() || !filled.includes(q.correctAnswer.trim())) {
        setError(`Question ${i + 1}: choose which option is correct.`);
        return;
      }
    }

    setBusy(true);
    const res = await fetch(
      editing.id ? `/api/admin/competitions/${editing.id}` : "/api/admin/competitions",
      {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editing.title,
          description: editing.description || null,
          type: editing.type,
          status: editing.status,
          visibility: editing.visibility,
          questions: editing.questions.map((q) => ({
            text: q.text,
            options: q.options.map((o) => o.trim()).filter(Boolean),
            correctAnswer: q.correctAnswer.trim(),
            timeLimitSeconds: Number(q.timeLimitSeconds) || 30,
          })),
        }),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not save that quiz.")
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function act(id: string, method: "POST" | "DELETE", confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/competitions/${id}`, { method });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "That didn't work.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}

      <div className="admin__actions">
        <button type="button" className="btn btn--primary" onClick={() => setEditing({ ...BLANK })}>
          New quiz
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Who can play</th>
              <th>Questions</th>
              <th>Played</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No quizzes yet. Create your first one.
                </td>
              </tr>
            )}
            {initial.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.title}</b>
                  <br />
                  <span className="muted">{c.type} · {c.status}</span>
                </td>
                <td>
                  <span className="pill">{c.visibility}</span>
                </td>
                <td>{c.questions.length}</td>
                <td>{c.sessions}</td>
                <td className="table__actions">
                  {c.sessions === 0 ? (
                    <button type="button" onClick={() => openEdit(c)}>
                      Edit
                    </button>
                  ) : (
                    <span className="muted" title="Its questions are part of the results">
                      locked
                    </span>
                  )}
                  <button type="button" onClick={() => act(c.id, "POST")} disabled={busy}>
                    Duplicate
                  </button>
                  {c.sessions === 0 && (
                    <button
                      type="button"
                      onClick={() => act(c.id, "DELETE", `Delete "${c.title}"?`)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit quiz">
          <form className="modal__box" onSubmit={save}>
            <h2>{editing.id ? "Edit quiz" : "New quiz"}</h2>

            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
              />
            </label>

            <div className="row">
              <label>
                Who can play
                <select
                  value={editing.visibility}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      visibility: e.target.value as Competition["visibility"],
                    })
                  }
                >
                  <option value="MEMBERS">Members only — child signs in</option>
                  <option value="UNLISTED">Anyone with the join code</option>
                  <option value="PUBLIC">Public — listed, host admits players</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="finished">Finished</option>
                </select>
              </label>
            </div>

            <fieldset className="sessions">
              <legend>Questions ({editing.questions.length})</legend>

              {editing.questions.map((question, qi) => (
                <div key={qi} className="question">
                  <div className="question__head">
                    <b>Question {qi + 1}</b>
                    {editing.questions.length > 1 && (
                      <button
                        type="button"
                        className="session__remove"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            questions: editing.questions.filter((_, idx) => idx !== qi),
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label>
                    Question
                    <input
                      value={question.text}
                      onChange={(e) => patchQuestion(qi, { text: e.target.value })}
                      placeholder="What does HTML stand for?"
                    />
                  </label>

                  <p className="muted" style={{ fontSize: "0.8rem" }}>
                    Select the radio button next to the correct answer.
                  </p>

                  {question.options.map((option, oi) => (
                    <div className="option" key={oi}>
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={
                          option.trim() !== "" && question.correctAnswer === option
                        }
                        onChange={() => patchQuestion(qi, { correctAnswer: option })}
                        // Cannot mark a blank option correct — that is how you
                        // end up with an unanswerable question.
                        disabled={option.trim() === ""}
                        aria-label={`Option ${oi + 1} is correct`}
                      />
                      <input
                        value={option}
                        onChange={(e) => setOption(qi, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                      />
                      {question.options.length > 2 && (
                        <button
                          type="button"
                          className="session__remove"
                          onClick={() =>
                            patchQuestion(qi, {
                              options: question.options.filter((_, idx) => idx !== oi),
                              correctAnswer:
                                question.correctAnswer === option
                                  ? ""
                                  : question.correctAnswer,
                            })
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="row">
                    {question.options.length < 6 && (
                      <button
                        type="button"
                        onClick={() =>
                          patchQuestion(qi, { options: [...question.options, ""] })
                        }
                      >
                        Add option
                      </button>
                    )}
                    <label>
                      Time limit (seconds)
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={question.timeLimitSeconds}
                        onChange={(e) =>
                          patchQuestion(qi, { timeLimitSeconds: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    questions: [
                      ...editing.questions,
                      { ...BLANK_QUESTION, options: ["", ""] },
                    ],
                  })
                }
              >
                Add question
              </button>
            </fieldset>

            <div className="modal__actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Saving…" : "Save quiz"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
