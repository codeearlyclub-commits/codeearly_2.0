/**
 * A single post.
 *
 * Body content is rendered by LessonBlocks — the same typed-block renderer the
 * lessons use. That is deliberate: it means a post cannot contain markup either,
 * so the public blog has no XSS surface even though anyone on staff can publish
 * to it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicPost, listPublicPosts } from "@/server/content/content";
import { LessonBlocks } from "@/components/portal/LessonBlocks";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPublicPost(slug);
    return {
      title: post.title,
      description: post.excerpt ?? undefined,
      openGraph: {
        title: post.title,
        description: post.excerpt ?? undefined,
        type: "article",
        publishedTime: post.publishedAt?.toISOString(),
        images: post.coverUrl ? [post.coverUrl] : undefined,
      },
    };
  } catch {
    return { title: "Post not found" };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  let post;
  try {
    post = await getPublicPost(slug);
  } catch (err) {
    // A draft and a typo are the same thing to a reader: a page that isn't there.
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const recent = (await listPublicPosts({ take: 5 })).filter((p) => p.id !== post.id).slice(0, 4);

  return (
    <>
      <div className="post-hero">
        <div className="post-hero-grid" />
        <div className="ph-content">
          {post.tags[0] && <span className="ph-tag">{post.tags[0]}</span>}
          <h1 className="ph-h1">{post.title}</h1>
          <div className="ph-meta">
            <span>{post.author}</span>
            {post.publishedAt && <span>{dateFmt.format(post.publishedAt)}</span>}
          </div>
          {post.coverUrl ? (
            <div
              className="ph-img ph-img-cover"
              style={{
                backgroundImage: `url(${post.coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : (
            <div className="ph-img" style={{ background: "linear-gradient(135deg,#0A5566,#00B8D4)" }}>
              ✏️
            </div>
          )}
        </div>
      </div>

      <div className="post-layout">
        <div className="post-inner">
          <article className="post-content">
            {post.excerpt && (
              <div className="callout">
                <p>{post.excerpt}</p>
              </div>
            )}

            <LessonBlocks blocks={post.blocks} />

            {post.tags.length > 0 && (
              <div className="post-tags">
                {post.tags.map((tag) => (
                  <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="p-tag">
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="author-box">
              <div className="auth-av">{post.author.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="auth-n">{post.author}</div>
                <div className="auth-r">CodeEarly Club</div>
                <div className="auth-b">
                  We teach African children aged 7 to 16 to code, create and lead —
                  through live classes, self-paced courses and holiday programs.
                </div>
              </div>
            </div>
          </article>

          <aside className="sidebar">
            {recent.length > 0 && (
              <div className="sb-card">
                <h4>More from the blog</h4>
                {recent.map((item) => (
                  <Link className="sb-post" key={item.id} href={`/blog/${item.slug}`}>
                    <div className="sb-th" style={{ background: "var(--green-light)" }}>
                      📄
                    </div>
                    <div>
                      <div className="sb-pt">{item.title}</div>
                      <div className="sb-pd">
                        {item.publishedAt ? dateFmt.format(item.publishedAt) : ""}
                      </div>
                    </div>
                  </Link>
                ))}
                <div className="sb-view-all">
                  <Link href="/blog">See all posts →</Link>
                </div>
              </div>
            )}

            <div className="sb-card sb-cta">
              <h4>Ready to start?</h4>
              <p>
                Join the club and give your child their own sign-in, their own
                courses, and something to build every week.
              </p>
              <Link className="btn-primary sidebar-join" href="/register">
                Join the Club →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
