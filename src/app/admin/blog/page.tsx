/**
 * Blog — staff view.
 *
 * Drafts sit alongside live posts in one list, ordered draft-first. Hiding
 * unfinished work in a separate tab is how it gets forgotten.
 */
import { listAllPosts } from "@/server/content/content";
import { PostsList } from "./PostsList";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminBlogPage() {
  const posts = await listAllPosts();

  return (
    <>
      <header className="admin__head">
        <h1>Blog</h1>
        <p className="muted">
          Posts are made of typed blocks, not HTML — so nothing an author writes
          can inject markup into a reader&apos;s browser.
        </p>
      </header>

      <PostsList
        posts={posts.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          author: p.author,
          tags: p.tags,
          publishedAt: p.publishedAt ? dateFmt.format(p.publishedAt) : null,
          updatedAt: dateFmt.format(p.updatedAt),
          blocks: p._count.blocks,
        }))}
      />
    </>
  );
}
