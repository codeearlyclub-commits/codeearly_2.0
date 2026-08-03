/**
 * Blog archive — V4's design, live data.
 *
 * Filtering is a plain GET form rather than client state, so a filtered view has
 * a URL. Someone can send "here are all our Scratch posts" as a link, and the
 * page needs no JavaScript to work at all.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicPosts, listPublicTags } from "@/server/content/content";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, updates and ideas for parents raising a child who codes — from the CodeEarly Club team.",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; tag?: string }> };

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const thumbClasses = ["pt1", "pt2", "pt3", "pt4", "pt5"];
const thumbIcons = ["✏️", "🧠", "🚀", "💡", "🎯", "🌱", "🧩"];

/** Roughly 200 words a minute, floored at one. */
function readingTime(excerpt: string | null): string {
  const words = (excerpt ?? "").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default async function BlogPage({ searchParams }: Props) {
  const { q, tag } = await searchParams;

  const [posts, tags] = await Promise.all([
    listPublicPosts({ q, tag }),
    listPublicTags(),
  ]);

  const filtering = Boolean(q || tag);
  // The newest post gets the wide treatment — but only on the unfiltered view,
  // where "featured" means something. In a search result it would just be the
  // first row rendered differently for no reason.
  const featured = filtering ? null : (posts[0] ?? null);
  const grid = featured ? posts.slice(1) : posts;

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-grid" />
        <div
          className="page-hero-blob"
          style={{ width: 380, height: 380, background: "rgba(0,200,150,0.1)", top: -70, right: -50 }}
        />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">The CodeEarly Blog</div>
          <h1>
            Ideas for raising a <span className="accent">SuperKoder</span>.
          </h1>
          <p>
            What we&apos;ve learned teaching thousands of Nigerian children to code —
            written for the parents doing it alongside them.
          </p>
        </div>
      </div>

      <div className="blog-controls">
        <div className="cat-btns">
          <Link
            href="/blog"
            className={tag ? "cat-btn" : "cat-btn active"}
            style={{ textDecoration: "none" }}
          >
            All
          </Link>
          {tags.map((t) => (
            <Link
              key={t}
              href={`/blog?tag=${encodeURIComponent(t)}`}
              className={t === tag ? "cat-btn active" : "cat-btn"}
              style={{ textDecoration: "none" }}
            >
              {t}
            </Link>
          ))}
        </div>

        <form className="srch" method="get">
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search the blog…"
            aria-label="Search posts"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      <section className="blog-archive-section">
        {posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-title">
              {filtering ? "Nothing matches that yet" : "The first post is on its way"}
            </div>
            <p>
              {filtering ? (
                <Link href="/blog">See all posts</Link>
              ) : (
                <>We&apos;re writing. Check back shortly.</>
              )}
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <Link className="feat-post" href={`/blog/${featured.slug}`}>
                <div className="feat-thumb">{thumbIcons[0]}</div>
                <div className="feat-body">
                  {featured.tags[0] && <span className="feat-tag">{featured.tags[0]}</span>}
                  <h2 className="feat-title">{featured.title}</h2>
                  {featured.excerpt && <p className="feat-exc">{featured.excerpt}</p>}
                  <div className="feat-meta">
                    {featured.author}
                    {featured.publishedAt ? ` · ${dateFmt.format(featured.publishedAt)}` : ""}
                  </div>
                  <span className="feat-rm">Read the post →</span>
                </div>
              </Link>
            )}

            <div className="posts-grid">
              {grid.map((post, i) => (
                <Link className="post-card" key={post.id} href={`/blog/${post.slug}`}>
                  <div className={`post-thumb ${thumbClasses[i % thumbClasses.length]}`}>
                    {thumbIcons[(i + 1) % thumbIcons.length]}
                  </div>
                  <div className="post-body">
                    {post.tags[0] && <span className="post-tag">{post.tags[0]}</span>}
                    <div className="post-title">{post.title}</div>
                    {post.excerpt && <div className="post-exc">{post.excerpt}</div>}
                    <div className="post-foot">
                      <span className="post-date">
                        {post.publishedAt ? dateFmt.format(post.publishedAt) : "Draft"}
                      </span>
                      <span className="post-read">{readingTime(post.excerpt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
