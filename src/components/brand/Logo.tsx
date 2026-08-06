import Link from "next/link";
import Image from "next/image";

/**
 * The CodeEarly logo. One component, every surface.
 *
 * Written because the wordmark was being retyped as `Code<span>Early</span>` in
 * the portal bar, the admin rail and each sign-in door — four places to drift
 * apart, and none of them the actual brand.
 *
 * THE DARK-SURFACE PROBLEM
 *
 * logo-codeearly.png is a TRANSPARENT png whose wordmark is near-black. Dropped
 * straight onto the navy portal bar or admin rail it simply disappears — only
 * the boy's white shirt survives. So on dark surfaces it sits on a white chip.
 *
 * That is deliberately not a CSS filter: `brightness(0) invert(1)` would make it
 * legible by flattening the illustration to a white silhouette, throwing away
 * the character that makes it CodeEarly's logo rather than any logo.
 *
 * `mark` is the compact square form for places the full logo cannot fit
 * legibly — at 48px wide the wordmark is about six pixels tall and unreadable.
 */
const RATIO = 230 / 139; // the PNG's true aspect; hardcoding it avoids layout shift

export function Logo({
  height = 34,
  onDark = false,
  mark = false,
  href = "/",
  className,
  priority = false,
}: {
  height?: number;
  /** Put it on a white chip so the near-black wordmark stays legible. */
  onDark?: boolean;
  /** Use the square monogram instead of the full logo. */
  mark?: boolean;
  /** Pass null to render the image without wrapping it in a link. */
  href?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const image = mark ? (
    // No border-radius here: logo-mark.svg draws its own rounded rect, and
    // rounding it again would shave the corners off the artwork.
    <Image
      src="/logo-mark.svg"
      alt="CodeEarly Club"
      width={height}
      height={height}
      priority={priority}
      style={{ display: "block" }}
    />
  ) : (
    <Image
      src="/logo-codeearly.png"
      alt="CodeEarly Club"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      style={{ display: "block", width: "auto", height }}
    />
  );

  // The chip hugs the artwork rather than boxing it — enough padding to read as
  // intentional, not so much that it becomes a card.
  const content =
    onDark && !mark ? (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#fff",
          borderRadius: 10,
          padding: "5px 9px",
        }}
      >
        {image}
      </span>
    ) : (
      image
    );

  if (href === null) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={href} className={className} aria-label="CodeEarly Club — home">
      {content}
    </Link>
  );
}
