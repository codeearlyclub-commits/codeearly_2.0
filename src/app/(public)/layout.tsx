/**
 * Public marketing layout — header, footer, and the site stylesheet.
 *
 * Separate from the portal layout on purpose: the portal is an application and
 * the website is a shopfront. They share the brand tokens, not the chrome.
 */
import "@/styles/site.css";

import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Keyboard and screen-reader users should not have to walk the nav on
          every page before reaching the content. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
