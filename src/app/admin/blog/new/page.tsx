import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { PostEditor } from "../PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  // Default the byline to whoever is writing. It stays editable — plenty of
  // posts are drafted by one person and credited to another.
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <>
      <header className="admin__head">
        <h1>New post</h1>
      </header>

      <PostEditor
        initial={{
          id: null,
          title: "",
          excerpt: "",
          author: session?.user?.name || "CodeEarly Team",
          coverUrl: "",
          tags: "",
          status: "DRAFT",
          blocks: [{ kind: "TEXT", text: "", meta: "" }],
        }}
      />
    </>
  );
}
