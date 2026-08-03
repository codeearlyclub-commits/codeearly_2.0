/**
 * Site primitives — ported from the live V4 site.
 *
 * Class names match V4's exactly so `site-v4.css` styles them unchanged. The
 * types are local and minimal: V4's versions imported a CMS content model, and
 * 2.0 feeds these from the database or from page-level constants instead.
 *
 * All server components — V4's needed `"use client"` only for framer-motion, and
 * without it there is no reason to ship JavaScript for a static card grid.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export type CardItem = {
  title: string;
  description?: string;
  icon?: string;
  tag?: string;
  meta?: string[];
  href?: string;
};

export type HeroCopy = {
  eyebrow: string;
  title: string;
  accent?: string;
  subtitle: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

/** Inner-page hero (not the homepage — that is HomeHero). */
export function PageHero({ hero, variant }: { hero: HeroCopy; variant?: string }) {
  return (
    <section className={variant ? `page-hero ${variant}` : "page-hero"}>
      <div className="page-hero-grid" />
      <div
        className="page-hero-blob"
        style={{ width: 400, height: 400, background: "rgba(0,200,150,0.09)", top: -80, right: -60 }}
      />
      <div
        className="page-hero-blob"
        style={{ width: 220, height: 220, background: "rgba(155,109,255,0.06)", bottom: 20, left: "10%" }}
      />
      <div className="page-hero-content">
        <div className="page-hero-eyebrow">{hero.eyebrow}</div>
        <h1>
          {hero.title} {hero.accent ? <span className="accent">{hero.accent}</span> : null}
        </h1>
        <p>{hero.subtitle}</p>
        {hero.primary || hero.secondary ? (
          <div className="hero-btns" style={{ marginTop: 32 }}>
            {hero.primary ? (
              <Link className="hbtn-p" href={hero.primary.href}>
                {hero.primary.label} →
              </Link>
            ) : null}
            {hero.secondary ? (
              <Link className="hbtn-s" href={hero.secondary.href}>
                {hero.secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="section-eyebrow">{eyebrow}</div>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-sub">{subtitle}</p> : null}
    </div>
  );
}

const viColors = ["vi-g", "vi-b", "vi-o", "vi-n"];

export function FeatureGrid({ items }: { items?: CardItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="val-grid site-card-grid">
      {items.map((item, index) => (
        <article className="val-card" key={item.title}>
          {item.icon ? <div className={`vi ${viColors[index % viColors.length]}`}>{item.icon}</div> : null}
          <div className="vt">{item.title}</div>
          <div className="vd">{item.description}</div>
        </article>
      ))}
    </div>
  );
}

const courseThumbClasses = ["ct-bl", "ct-gr", "ct-gd", "ct-tl", "ct-co", "ct-pu"];

function courseLevelClass(tag?: string) {
  const value = tag?.toLowerCase();
  if (value === "advanced") return "lv-a";
  if (value === "intermediate") return "lv-i";
  return "lv-b";
}

export function CourseGrid({
  items,
  variant = "preview",
  actionLabel = "Enroll →",
}: {
  items?: CardItem[];
  variant?: "preview" | "catalog";
  actionLabel?: string;
}) {
  if (!items?.length) return null;
  return (
    <div className={variant === "catalog" ? "courses-grid" : "c-row site-card-grid"}>
      {items.map((item, index) => (
        <article className="c-card" key={item.title}>
          <div className={`c-thumb ${courseThumbClasses[index % courseThumbClasses.length]}`}>
            {item.icon}
            {item.tag ? <span className={`c-lv ${courseLevelClass(item.tag)}`}>{item.tag}</span> : null}
          </div>
          <div className="c-body">
            {item.meta?.length ? (
              <div className="c-meta">
                {item.meta.map((meta) => (
                  <span key={meta}>{meta}</span>
                ))}
              </div>
            ) : null}
            <div className="c-title">{item.title}</div>
            <div className="c-desc">{item.description}</div>
            <div className="c-foot">
              <div className="c-inst">CodeEarly Team</div>
              {item.href ? (
                <Link className={variant === "catalog" ? "c-btn" : "c-enroll"} href={item.href}>
                  {actionLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EventGrid({ items }: { items?: CardItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="event-grid site-card-grid">
      {items.map((item) => (
        <article className="event-card" key={item.title}>
          <div className="event-date">{item.icon}</div>
          <div className="event-info">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.meta?.length ? (
              <div className="event-meta">
                {item.meta.map((meta) => (
                  <span key={meta}>{meta}</span>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function FaqGrid({ items }: { items?: Array<{ question: string; answer: string }> }) {
  if (!items?.length) return null;
  return (
    <div className="faq-grid">
      {items.map((item) => (
        <details className="faq-item" key={item.question} name="site-faq">
          <summary className="faq-q">
            <span>{item.question}</span>
            <span className="faq-arrow" aria-hidden="true">
              ▼
            </span>
          </summary>
          <div className="faq-a">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

const avatarColors = [
  { background: "var(--green-light)", color: "#008060" },
  { background: "var(--sky-light)", color: "#1A3C6E" },
  { background: "var(--purple-light)", color: "#4A2080" },
  { background: "var(--yellow-light)", color: "#8B5A00" },
];

export function Testimonials({
  items,
}: {
  items?: Array<{ id: string; quote: string; author: string; role: string | null }>;
}) {
  if (!items?.length) return null;
  return (
    <div className="t-grid">
      {items.map((item, i) => (
        // The first card gets the dark treatment, as V4 did — one accent in the
        // grid rather than a wall of identical white boxes.
        <article className={i === 0 ? "t-card feat" : "t-card"} key={item.id}>
          <div className="t-stars">★★★★★</div>
          <p className="t-quote">&ldquo;{item.quote}&rdquo;</p>
          <div className="t-auth">
            <div className="t-av" style={avatarColors[i % avatarColors.length]}>
              {item.author.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="t-name">{item.author}</div>
              {item.role && <div className="t-role">{item.role}</div>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Stats({ stats }: { stats?: Array<{ value: string; label: string }> }) {
  if (!stats?.length) return null;
  return (
    <div className="hero-stats site-stat-strip">
      {stats.map((stat) => (
        <div key={`${stat.value}-${stat.label}`}>
          <div className="stat-n">{stat.value}</div>
          <div className="stat-l">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

export function CtaBanner() {
  return (
    <div className="cta-banner fade-up visible">
      <div className="cta-banner-content">
        <h2>
          Ready to raise a <span>SuperKoder?</span>
        </h2>
        <p>
          Join 5000+ kids across Nigeria who are already building their tech future
          with CodeEarly.
        </p>
        <div className="cta-actions">
          <Link className="btn-primary" href="/register">
            Join the Club Today →
          </Link>
          <Link className="btn-secondary" href="/contact">
            Talk to us first
          </Link>
        </div>
      </div>
    </div>
  );
}
