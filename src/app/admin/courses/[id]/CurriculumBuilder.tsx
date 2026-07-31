"use client";

/**
 * Curriculum builder — sections, lessons, and the block editor.
 *
 * Two things drive the design:
 *
 *  1. **Blocks are typed, so the editor is too.** There is no rich-text box that
 *     silently accepts pasted markup. Each block declares what it is, and the
 *     field adapts — a URL field for images, a language field for code. This is
 *     what makes the content safe to render without sanitising.
 *  2. **The consequences are stated before you act.** A lesson children have
 *     started says so, and its delete button says "Unpublish" instead, because
 *     that is what will actually happen.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BlockKind = "HEADING" | "TEXT" | "CODE" | "IMAGE" | "VIDEO" | "CALLOUT" | "LIST";
type LessonKind = "LESSON" | "PAGE" | "RESOURCE" | "QUIZ";

type Block = { kind: BlockKind; text: string; meta: string };

type LessonRow = {
  id: string;
  title: string;
  kind: LessonKind;
  summary: string | null;
  published: boolean;
  estimatedMinutes: number | null;
  videoUrl: string | null;
  blockCount: number;
  learners: number;
};

type Section = { id: string; title: string; summary: string | null; lessons: LessonRow[] };

type Draft = {
  id: string | null;
  sectionId: string | null;
  title: string;
  kind: LessonKind;
  summary: string;
  estimatedMinutes: string;
  videoUrl: string;
  published: boolean;
  blocks: Block[];
};

const BLOCK_LABEL: Record<BlockKind, string> = {
  HEADING: "Heading",
  TEXT: "Paragraphs",
  CODE: "Code",
  IMAGE: "Image",
  VIDEO: "Video",
  CALLOUT: "Callout",
  LIST: "List",
};

/** What the second field means for each block type — it is not the same thing. */
const META_LABEL: Partial<Record<BlockKind, string>> = {
  CODE: "Language (html, python…)",
  IMAGE: "Alt text — describe the image (required)",
  VIDEO: "Caption",
};

const PLACEHOLDER: Record<BlockKind, string> = {
  HEADING: "Section heading",
  TEXT: "Write in plain sentences. Leave a blank line between paragraphs.",
  CODE: "<p>Hello!</p>",
  IMAGE: "https://…/picture.png",
  VIDEO: "https://youtube.com/watch?v=…",
  CALLOUT: "A tip or warning worth pulling out.",
  LIST: "One item per line",
};

const BLANK: Draft = {
  id: null,
  sectionId: null,
  title: "",
  kind: "LESSON",
  summary: "",
  estimatedMinutes: "",
  videoUrl: "",
  published: false,
  blocks: [{ kind: "TEXT", text: "", meta: "" }],
};

export function CurriculumBuilder({
  courseId,
  courseSlug,
  sections,
  looseLessons,
}: {
  courseId: string;
  courseSlug: string;
  sections: Section[];
  looseLessons: LessonRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSection, setNewSection] = useState("");

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "That didn't work.")
      );
    }
    return body;
  }

  async function addSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSection.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await call(`/api/admin/courses/${courseId}/curriculum`, {
        method: "POST",
        body: JSON.stringify({ type: "section", title: newSection }),
      });
      setNewSection("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSection(section: Section) {
    if (
      !confirm(
        section.lessons.length > 0
          ? `Delete the section "${section.title}"? Its ${section.lessons.length} lesson(s) will NOT be deleted — they move to the course root.`
          : `Delete the section "${section.title}"?`
      )
    )
      return;
    setBusy(true);
    try {
      await call(`/api/admin/sections/${section.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openNew(sectionId: string | null) {
    setError(null);
    setDraft({ ...BLANK, sectionId, blocks: [{ kind: "TEXT", text: "", meta: "" }] });
  }

  async function openEdit(lesson: LessonRow, sectionId: string | null) {
    setError(null);
    setBusy(true);
    try {
      // Blocks are not in the list payload — a course with fifty lessons would
      // ship every word of every one of them just to render a table.
      const body = await call(`/api/admin/lessons/${lesson.id}/blocks`, { method: "GET" });
      setDraft({
        id: lesson.id,
        sectionId,
        title: lesson.title,
        kind: lesson.kind,
        summary: lesson.summary ?? "",
        estimatedMinutes: lesson.estimatedMinutes ? String(lesson.estimatedMinutes) : "",
        videoUrl: lesson.videoUrl ?? "",
        published: lesson.published,
        blocks: body.blocks.map((b: { kind: BlockKind; text: string; meta: string | null }) => ({
          kind: b.kind,
          text: b.text,
          meta: b.meta ?? "",
        })),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setBusy(true);

    const payload = {
      title: draft.title,
      kind: draft.kind,
      summary: draft.summary || null,
      sectionId: draft.sectionId,
      estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
      videoUrl: draft.videoUrl || null,
      published: draft.published,
      blocks: draft.blocks
        .filter((b) => b.text.trim())
        .map((b) => ({ kind: b.kind, text: b.text, meta: b.meta || null })),
    };

    try {
      if (draft.id) {
        await call(`/api/admin/lessons/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await call(`/api/admin/courses/${courseId}/curriculum`, {
          method: "POST",
          body: JSON.stringify({ type: "lesson", ...payload }),
        });
      }
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson(lesson: LessonRow) {
    const warning =
      lesson.learners > 0
        ? `${lesson.learners} child(ren) have started "${lesson.title}". It will be UNPUBLISHED rather than deleted, so their progress survives. Continue?`
        : `Delete "${lesson.title}"? Nobody has started it, so it will be removed entirely.`;
    if (!confirm(warning)) return;

    setBusy(true);
    try {
      await call(`/api/admin/lessons/${lesson.id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function patchBlock(i: number, patch: Partial<Block>) {
    if (!draft) return;
    setDraft({
      ...draft,
      blocks: draft.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    });
  }

  function moveBlock(i: number, delta: number) {
    if (!draft) return;
    const next = [...draft.blocks];
    const target = i + delta;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target]!, next[i]!];
    setDraft({ ...draft, blocks: next });
  }

  const groups: Array<{ id: string | null; title: string; summary: string | null; lessons: LessonRow[] }> = [
    ...(looseLessons.length > 0
      ? [{ id: null, title: "Not in a section", summary: null, lessons: looseLessons }]
      : []),
    ...sections,
  ];

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}

      <div className="admin__actions">
        <button type="button" className="btn-primary" onClick={() => openNew(null)}>
          New lesson
        </button>
        <Link className="btn-secondary" href={`/learn/${courseSlug}`} target="_blank">
          Preview as a learner ↗
        </Link>
      </div>

      <form className="admin__search" onSubmit={addSection}>
        <input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          placeholder="New section title — e.g. Getting started"
          aria-label="New section title"
        />
        <button type="submit" className="btn-secondary" disabled={busy || !newSection.trim()}>
          Add section
        </button>
      </form>

      {groups.length === 0 && (
        <div className="panel">
          <p className="muted">
            No lessons yet. Add a section to group them, or create a lesson directly.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <div className="panel" key={group.id ?? "root"}>
          <div className="builder__head">
            <div>
              <h2>{group.title}</h2>
              {group.summary && <p className="muted">{group.summary}</p>}
            </div>
            <div className="table__actions">
              <button type="button" onClick={() => openNew(group.id)}>
                Add lesson
              </button>
              {group.id && (
                <button
                  type="button"
                  onClick={() => removeSection(group as Section)}
                  disabled={busy}
                >
                  Delete section
                </button>
              )}
            </div>
          </div>

          {group.lessons.length === 0 ? (
            <p className="muted">No lessons in this section yet.</p>
          ) : (
            <ol className="builder__list">
              {group.lessons.map((lesson, i) => (
                <li className="builder__item" key={lesson.id}>
                  <span className="builder__num">{i + 1}</span>
                  <span className="builder__main">
                    <b>{lesson.title}</b>
                    <span className="muted">
                      {lesson.blockCount} block{lesson.blockCount === 1 ? "" : "s"}
                      {lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ""}
                      {lesson.learners > 0
                        ? ` · ${lesson.learners} learner${lesson.learners === 1 ? "" : "s"} started`
                        : ""}
                    </span>
                  </span>
                  <span
                    className={`pill pill--${lesson.published ? "published" : "draft"}`}
                  >
                    {lesson.published ? "PUBLISHED" : "DRAFT"}
                  </span>
                  <span className="table__actions">
                    <button type="button" onClick={() => openEdit(lesson, group.id)} disabled={busy}>
                      Edit
                    </button>
                    <button type="button" onClick={() => removeLesson(lesson)} disabled={busy}>
                      {lesson.learners > 0 ? "Unpublish" : "Delete"}
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}

      {/* ── Lesson editor ───────────────────────────────────────────────────── */}
      {draft && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit lesson">
          <form className="modal__box modal__box--wide" onSubmit={saveLesson}>
            <h2>{draft.id ? "Edit lesson" : "New lesson"}</h2>

            <label>
              Title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                minLength={3}
              />
            </label>

            <label>
              Summary <span className="muted">— one line, shown in the curriculum</span>
              <input
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                maxLength={600}
              />
            </label>

            <div className="row">
              <label>
                Type
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as LessonKind })}
                >
                  <option value="LESSON">Lesson</option>
                  <option value="PAGE">Reading</option>
                  <option value="RESOURCE">Resource</option>
                  <option value="QUIZ">Quiz</option>
                </select>
              </label>
              <label>
                Minutes
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={draft.estimatedMinutes}
                  onChange={(e) => setDraft({ ...draft, estimatedMinutes: e.target.value })}
                />
              </label>
              <label>
                Section
                <select
                  value={draft.sectionId ?? ""}
                  onChange={(e) => setDraft({ ...draft, sectionId: e.target.value || null })}
                >
                  <option value="">— none —</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Video link <span className="muted">— YouTube or Vimeo, never uploaded here</span>
              <input
                value={draft.videoUrl}
                onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=…"
              />
            </label>

            <fieldset className="sessions">
              <legend>Content ({draft.blocks.length} blocks)</legend>

              {draft.blocks.map((block, i) => (
                <div className="question" key={i}>
                  <div className="question__head">
                    <select
                      value={block.kind}
                      onChange={(e) => patchBlock(i, { kind: e.target.value as BlockKind })}
                      aria-label={`Block ${i + 1} type`}
                    >
                      {(Object.keys(BLOCK_LABEL) as BlockKind[]).map((k) => (
                        <option key={k} value={k}>
                          {BLOCK_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <span className="table__actions">
                      <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(i, 1)}
                        disabled={i === draft.blocks.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="session__remove"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            blocks: draft.blocks.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        Remove
                      </button>
                    </span>
                  </div>

                  <textarea
                    rows={block.kind === "TEXT" || block.kind === "CODE" ? 5 : 2}
                    value={block.text}
                    onChange={(e) => patchBlock(i, { text: e.target.value })}
                    placeholder={PLACEHOLDER[block.kind]}
                  />

                  {META_LABEL[block.kind] && (
                    <label>
                      {META_LABEL[block.kind]}
                      <input
                        value={block.meta}
                        onChange={(e) => patchBlock(i, { meta: e.target.value })}
                      />
                    </label>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, blocks: [...draft.blocks, { kind: "TEXT", text: "", meta: "" }] })
                }
              >
                Add block
              </button>
            </fieldset>

            <label className="check">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              Published — visible to enrolled children
            </label>

            <div className="modal__actions">
              <button type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save lesson"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
