"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  author: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string;
  blocks: number;
};

export function PostsList({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(post: PostRow) {
    if (
      !confirm(
        post.status === "PUBLISHED"
          ? `"${post.title}" is live. Deleting it will break any link already shared. Archive it instead unless you're sure. Delete anyway?`
          : `Delete "${post.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      setError("Could not delete that post.");
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
        <Link className="btn-primary" href="/admin/blog/new">
          New post
        </Link>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Author</th>
              <th>Blocks</th>
              <th>Published</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No posts yet. Write the first one.
                </td>
              </tr>
            )}
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <b>{post.title}</b>
                  <br />
                  <code className="muted">/blog/{post.slug}</code>
                  {post.tags.map((tag) => (
                    <span className="pill" key={tag}>
                      {tag}
                    </span>
                  ))}
                </td>
                <td>
                  <span className={`pill pill--${post.status.toLowerCase()}`}>{post.status}</span>
                </td>
                <td>{post.author}</td>
                <td>{post.blocks}</td>
                <td>{post.publishedAt ?? "—"}</td>
                <td className="table__actions">
                  <Link className="table__link" href={`/admin/blog/${post.id}`}>
                    Edit
                  </Link>
                  {post.status === "PUBLISHED" && (
                    <a
                      className="table__link"
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  )}
                  <button type="button" onClick={() => remove(post)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
