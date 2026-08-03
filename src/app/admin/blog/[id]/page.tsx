import { notFound } from "next/navigation";

import { getPostForEdit } from "@/server/content/content";
import { isAppError } from "@/lib/errors";
import { PostEditor, type EditorBlock } from "../PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let post;
  try {
    post = await getPostForEdit(id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return (
    <>
      <header className="admin__head">
        <h1>{post.title}</h1>
      </header>

      <PostEditor
        initial={{
          id: post.id,
          title: post.title,
          excerpt: post.excerpt ?? "",
          author: post.author,
          coverUrl: post.coverUrl ?? "",
          tags: post.tags.join(", "),
          status: post.status,
          blocks: post.blocks.map(
            (b): EditorBlock => ({
              kind: b.kind as EditorBlock["kind"],
              text: b.text,
              meta: b.meta ?? "",
            })
          ),
        }}
      />
    </>
  );
}
