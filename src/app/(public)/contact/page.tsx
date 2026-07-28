import type { Metadata } from "next";

import { ContactForm } from "@/components/site/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about courses, programs or membership? Talk to the CodeEarly Club team.",
};

export default function ContactPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <h1>Talk to us</h1>
          <p>
            Questions about which course suits your child, how programs run, or
            anything else — we&apos;re happy to help.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <ContactForm />

          <aside className="contact-aside">
            <h2>Other ways to reach us</h2>
            <p>
              <b>Email</b>
              <br />
              <a href="mailto:info@codeearly.com">info@codeearly.com</a>
            </p>
            <p>
              <b>Already a member?</b>
              <br />
              Sign in to your portal and message us from there — we&apos;ll have
              your child&apos;s details to hand.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
