"use client";

/**
 * Showcase editor.
 *
 * The consent field is the important control on this screen. Publishing a
 * child's project without recorded parental consent is refused three times over:
 * the button is disabled here, the service throws, and the database has a CHECK
 * constraint. That is deliberate belt-and-braces — this is the one screen where
 * a mistake is published to the open internet and is about a child.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ShowcaseRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  childFirstName: string;
  childAge: number | null;
  mediaUrl: string | null;
  projectUrl: string | null;
  tags: string[];
  featured: boolean;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  consentBy: string | null;
  consentGivenAt: string | null;
};

type Draft = {
  id: string;
  title: string;
  description: string;
  childFirstName: string;
  childAge: string;
  mediaUrl: string;
  projectUrl: string;
  tags: string;
  featured: boolean;
  status: ShowcaseRow["status"];
  consentBy: string;
};

const BLANK: Draft = {
  id: "",
  title: "",
  description: "",
  childFirstName: "",
  childAge: "",
  mediaUrl: "",
  projectUrl: "",
  tags: "",
  featured: false,
  status: "DRAFT",
  consentBy: "",
};

export function ShowcaseAdmin({ projects }: { projects: ShowcaseRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPublish = Boolean(editing?.consentBy.trim());

  function openEdit(project: ShowcaseRow) {
    setError(null);
    setEditing({
      id: project.id,
      title: project.title,
      description: project.description ?? "",
      childFirstName: project.childFirstName,
      childAge: project.childAge === null ? "" : String(project.childAge),
      mediaUrl: project.mediaUrl ?? "",
      projectUrl: project.projectUrl ?? "",
      tags: project.tags.join(", "),
      featured: project.featured,
      status: project.status,
      consentBy: project.consentBy ?? "",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);

    const payload = {
      title: editing.title,
      description: editing.description || null,
      childFirstName: editing.childFirstName,
      childAge: editing.childAge ? Number(editing.childAge) : null,
      mediaUrl: editing.mediaUrl || null,
      projectUrl: editing.projectUrl || null,
      tags: editing.tags.split(",").map((t) => t.trim()).filter(Boolean),
      featured: editing.featured,
      status: editing.status,
      consentBy: editing.consentBy || null,
    };

    const res = await fetch(
      editing.id ? `/api/admin/showcase/${editing.id}` : "/api/admin/showcase",
      {
        method: editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "Could not save that project.")
      );
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function remove(project: ShowcaseRow) {
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/showcase/${project.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Could not delete that project.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="admin__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setError(null);
            setEditing({ ...BLANK });
          }}
        >
          Add a project
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Child</th>
              <th>Status</th>
              <th>Consent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nothing in the showcase yet.
                </td>
              </tr>
            )}
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <b>{project.title}</b>
                  {project.featured && <span className="pill">featured</span>}
                  <br />
                  <code className="muted">/showcase</code>
                </td>
                <td>
                  {project.childFirstName}
                  {project.childAge !== null ? `, ${project.childAge}` : ""}
                </td>
                <td>
                  <span className={`pill pill--${project.status.toLowerCase()}`}>
                    {project.status}
                  </span>
                </td>
                <td>
                  {project.consentGivenAt ? (
                    <>
                      {project.consentBy}
                      <br />
                      <span className="muted">{project.consentGivenAt}</span>
                    </>
                  ) : (
                    <span className="pill pill--lock">not recorded</span>
                  )}
                </td>
                <td className="table__actions">
                  <button type="button" onClick={() => openEdit(project)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(project)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Edit showcase project">
          <form className="modal__box modal__box--wide" onSubmit={save}>
            <h2>{editing.id ? "Edit project" : "Add a project"}</h2>

            <label>
              Project title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                required
                minLength={3}
                maxLength={140}
              />
            </label>

            <label>
              What is it?
              <textarea
                rows={3}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                maxLength={2000}
              />
            </label>

            <div className="row">
              <label>
                Child&apos;s FIRST name only
                <input
                  value={editing.childFirstName}
                  onChange={(e) => setEditing({ ...editing, childFirstName: e.target.value })}
                  required
                  maxLength={40}
                  placeholder="Ada"
                />
              </label>
              <label>
                Age
                <input
                  type="number"
                  min={3}
                  max={18}
                  value={editing.childAge}
                  onChange={(e) => setEditing({ ...editing, childAge: e.target.value })}
                />
              </label>
            </div>

            <p className="muted">
              First name only — never a surname, school or city. This page is public
              and readable by anyone.
            </p>

            <div className="row">
              <label>
                Project link
                <input
                  value={editing.projectUrl}
                  onChange={(e) => setEditing({ ...editing, projectUrl: e.target.value })}
                  maxLength={600}
                  placeholder="https://scratch.mit.edu/projects/…"
                />
              </label>
              <label>
                Image or video URL
                <input
                  value={editing.mediaUrl}
                  onChange={(e) => setEditing({ ...editing, mediaUrl: e.target.value })}
                  maxLength={600}
                />
              </label>
            </div>

            <div className="row">
              <label>
                Tags
                <input
                  value={editing.tags}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="Scratch, Game"
                />
              </label>
              <label>
                Status
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as Draft["status"] })
                  }
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED" disabled={!canPublish}>
                    Published {canPublish ? "" : "— record consent first"}
                  </option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>

            <label>
              Parental consent given by
              <input
                value={editing.consentBy}
                onChange={(e) => setEditing({ ...editing, consentBy: e.target.value })}
                maxLength={120}
                placeholder="Parent's name, and how they gave it"
              />
            </label>
            <p className="muted">
              Required before this can be published. The date is stamped automatically
              when you first record it.
            </p>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.featured}
                onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
              />
              Feature this on the showcase page
            </label>

            <div className="modal__actions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
