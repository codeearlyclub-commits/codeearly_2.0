"use client";

/**
 * Blog post editor.
 *
 * Content is typed BLOCKS, not a rich-text field — the same model the lessons
 * use. That is what makes the public blog free of any markup-injection surface:
 * nothing an author types is ever parsed as HTML, so there is nothing to escape
 * and nothing to get wrong.
 *
 * The trade is that an author picks a block type instead of a toolbar button.
 * In practice that is one dropdown, and it makes the structure of a post
 * explicit rather than implied by formatting.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BLOCK_KINDS = [
  { value: "TEXT", label: "Paragraph(s)", hint: "Blank line between paragraphs." },
  { value: "HEADING", label: "Heading", hint: "One line." },
  { value: "LIST", label: "Bullet list", hint: "One item per line." },
  { value: "CODE", label: "Code", hint: "Meta = language, e.g. python." },
  { value: "CALLOUT", label: "Callout", hint: "A highlighted aside." },
  { value: "IMAGE", label: "Image", hint: "Text = URL, meta = alt text (required)." },
  { value: "VIDEO", label: "Video", hint: "YouTube or Vimeo link." },
] as const;

type Kind = (typeof BLOCK_KINDS)[number]["value"];

export type EditorBlock = { kind: Kind; text: string; meta: string };

export type PostDraft = {
  id: string | null;
  title: string;
  excerpt: string;
  author: string;
  coverUrl: string;
  tags: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  blocks: EditorBlock[];
};

export function PostEditor({ initial }: { initial: PostDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PostDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setBlock(index: number, patch: Partial<EditorBlock>) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  function addBlock() {
    setDraft((d) => ({ ...d, blocks: [...d.blocks, { kind: "TEXT", text: "", meta: "" }] }));
  }

  function removeBlock(index: number) {
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }));
  }

  /** Order is position in the array, so moving is a swap. */
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.blocks.length) return;
    setDraft((d) => {
      const blocks = [...d.blocks];
      [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
      return { ...d, blocks };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const imageMissingAlt = draft.blocks.some(
      (b) => b.kind === "IMAGE" && b.text.trim() && !b.meta.trim()
    );
    if (imageMissingAlt) {
      // Refused here rather than warned about: an image without alt text is
      // invisible to a screen reader, and "we'll add it later" never happens.
      setError("Every image needs alt text — describe it in the meta field.");
      return;
    }

    setBusy(true);
    const payload = {
      title: draft.title,
      excerpt: draft.excerpt || null,
      author: draft.author,
      coverUrl: draft.coverUrl || null,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      status: draft.status,
      blocks: draft.blocks
        .filter((b) => b.text.trim())
        .map((b) => ({ kind: b.kind, text: b.text, meta: b.meta || null })),
    };

    const res = await fetch(draft.id ? `/api/admin/posts/${draft.id}` : "/api/admin/posts", {
      method: draft.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not save that post.")
      );
      return;
    }

    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <form onSubmit={save}>
      <div className="admin__crumbs">
        <Link href="/admin/blog">← All posts</Link>
      </div>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="panel">
        <label>
          Title
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            required
            minLength={3}
            maxLength={160}
          />
        </label>

        <label>
          Excerpt
          <textarea
            rows={2}
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
            maxLength={400}
            placeholder="One or two sentences — this is what shows on the archive and in link previews."
          />
        </label>

        <div className="row">
          <label>
            Author
            <input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              maxLength={80}
            />
          </label>
          <label>
            Tags
            <input
              value={draft.tags}
              onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              placeholder="Scratch, Parents, Python"
            />
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as PostDraft["status"] })
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
        </div>

        <label>
          Cover image URL
          <input
            value={draft.coverUrl}
            onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })}
            maxLength={600}
            placeholder="https://…"
          />
        </label>

        {draft.id && draft.status === "PUBLISHED" && (
          <p className="muted">
            This post is live. Its URL is fixed now — renaming the title will not
            move it, so links already shared keep working.
          </p>
        )}
      </div>

      <div className="panel">
        <div className="builder__head">
          <h2>Content</h2>
          <button type="button" onClick={addBlock}>
            Add block
          </button>
        </div>

        {draft.blocks.length === 0 ? (
          <p className="muted">No content yet. Add a block to start writing.</p>
        ) : (
          <div className="sessions">
            {draft.blocks.map((block, i) => {
              const kind = BLOCK_KINDS.find((k) => k.value === block.kind);
              return (
                <div className="question" key={i}>
                  <div className="question__head">
                    <select
                      value={block.kind}
                      onChange={(e) => setBlock(i, { kind: e.target.value as Kind })}
                      aria-label={`Block ${i + 1} type`}
                    >
                      {BLOCK_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <div className="table__actions">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === draft.blocks.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="session__remove"
                        onClick={() => removeBlock(i)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={block.kind === "HEADING" || block.kind === "IMAGE" || block.kind === "VIDEO" ? 1 : 5}
                    value={block.text}
                    onChange={(e) => setBlock(i, { text: e.target.value })}
                    placeholder={kind?.hint}
                  />

                  {(block.kind === "IMAGE" ||
                    block.kind === "VIDEO" ||
                    block.kind === "CODE") && (
                    <input
                      value={block.meta}
                      onChange={(e) => setBlock(i, { meta: e.target.value })}
                      placeholder={
                        block.kind === "IMAGE"
                          ? "Alt text — describe the image (required)"
                          : block.kind === "CODE"
                            ? "Language, e.g. python"
                            : "Caption (optional)"
                      }
                      maxLength={400}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="admin__actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : draft.id ? "Save post" : "Create post"}
        </button>
        <Link className="btn-secondary" href="/admin/blog">
          Cancel
        </Link>
      </div>
    </form>
  );
}
