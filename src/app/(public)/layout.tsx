/**
 * Public marketing layout — the live V4 site's chrome.
 *
 * Order matters: `site-v4.css` is the ported design system and must come before
 * `site-anim.css`, which layers the animation classes that replace V4's
 * framer-motion sequences.
 *
 * Like V4's, this layout reads NO cookies. Doing so would force every public
 * page to render per-request and defeat caching — V4 learned that the hard way
 * (it caused ~10s cold loads). The navbar detects the session client-side.
 */
import "@/styles/site-v4.css";
import "@/styles/site-anim.css";
// Narrow supplement for page shapes V4 did not have (course/program detail,
// contact form). Defines no generic selectors, so it cannot override the design.
import "@/styles/site-extra.css";

import { Navbar } from "@/components/site/Navbar";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      {/* Keyboard and screen-reader users should not walk the nav on every page
          before reaching the content. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
