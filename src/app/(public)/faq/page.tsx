/**
 * FAQs — grouped by category, live from the database.
 *
 * Staff edit these at /admin/faqs. That matters more than it looks: the same
 * three questions arrive by email every week, and the person who can answer them
 * should be able to publish the answer without a deploy.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicFaqs } from "@/server/content/content";
import { FaqGrid, CtaBanner } from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers to what parents ask us most — about ages, pricing, safety, devices and how CodeEarly Club works.",
};

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await listPublicFaqs();

  // Grouped, preserving the order staff set. `null` becomes one unnamed group
  // rendered first, so an uncategorised FAQ is never invisible.
  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) {
    const key = faq.category?.trim() || "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(faq);
    else groups.set(key, [faq]);
  }

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-grid" />
        <div
          className="page-hero-blob"
          style={{ width: 340, height: 340, background: "rgba(0,200,150,0.09)", top: -60, right: -40 }}
        />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">Questions</div>
          <h1>
            Everything parents <span className="accent">ask us</span>.
          </h1>
          <p>
            If your question isn&apos;t here, ask us directly — we answer every message
            ourselves.
          </p>
        </div>
      </div>

      <section style={{ padding: "64px 5vw" }}>
        {faqs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">We&apos;re writing these up</div>
            <p>
              In the meantime, <Link href="/contact">just ask us</Link> — we reply
              within a day.
            </p>
          </div>
        ) : (
          [...groups.entries()].map(([category, items]) => (
            <div key={category || "general"} style={{ marginBottom: 48 }}>
              {category && <h2 className="section-title">{category}</h2>}
              <FaqGrid items={items.map((f) => ({ question: f.question, answer: f.answer }))} />
            </div>
          ))
        )}
      </section>

      <CtaBanner />
    </>
  );
}
