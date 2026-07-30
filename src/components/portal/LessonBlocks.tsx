/**
 * Renders lesson content blocks.
 *
 * Every block is plain text from the database — there is no `dangerouslySetInnerHTML`
 * anywhere in this file, and that is the point of storing blocks rather than HTML.
 * A lesson cannot inject markup into a child's browser because no markup is ever
 * parsed.
 */
import Image from "next/image";
import type { BlockKind } from "@prisma/client";

export type Block = {
  id: string;
  kind: BlockKind;
  text: string;
  meta: string | null;
};

/**
 * Turn a YouTube or Vimeo link into its embed form.
 *
 * Only known hosts are embedded. Anything else is offered as a plain link rather
 * than dropped into an iframe — an arbitrary URL in an iframe is somebody else's
 * code running inside our page, next to a child.
 */
function embedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function LessonBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => {
        switch (block.kind) {
          case "HEADING":
            return (
              <h2 key={block.id} className="block-heading">
                {block.text}
              </h2>
            );

          case "TEXT":
            return (
              <div key={block.id} className="block block-text">
                {/* Blank lines become paragraphs. Authors type prose, not markup. */}
                {block.text.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ marginBottom: 14 }}>
                    {para}
                  </p>
                ))}
              </div>
            );

          case "LIST":
            return (
              <ul key={block.id} className="block block-list">
                {block.text
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
            );

          case "CODE":
            return (
              <div key={block.id} className="block block-code">
                {block.meta && <span className="block-code__lang">{block.meta}</span>}
                {/* Rendered as text inside <pre>, never parsed as HTML. */}
                <pre>{block.text}</pre>
              </div>
            );

          case "CALLOUT":
            return (
              <div key={block.id} className="block block-callout">
                {block.text}
              </div>
            );

          case "IMAGE":
            return (
              <figure key={block.id} className="block block-image">
                {/* Alt text is required at authoring time, so it is always here. */}
                <Image
                  src={block.text}
                  alt={block.meta ?? ""}
                  width={900}
                  height={600}
                  style={{ width: "100%", height: "auto" }}
                  unoptimized
                />
                {block.meta && <figcaption>{block.meta}</figcaption>}
              </figure>
            );

          case "VIDEO": {
            const embed = embedUrl(block.text);
            if (!embed) {
              // Unknown host: a link, not an iframe.
              return (
                <p key={block.id} className="block block-text">
                  <a href={block.text} target="_blank" rel="noopener noreferrer">
                    Watch the video ↗
                  </a>
                </p>
              );
            }
            return (
              <figure key={block.id} className="block block-video">
                <iframe
                  src={embed}
                  title={block.meta ?? "Lesson video"}
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </figure>
            );
          }

          default:
            return null;
        }
      })}
    </>
  );
}
