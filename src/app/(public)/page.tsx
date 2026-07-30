/**
 * Home page — the live V4 site's structure and design.
 *
 * The sections are V4's, in V4's order, using V4's class names. The difference is
 * where the content comes from: courses and the featured program are read LIVE
 * from the database, so the homepage cannot drift out of sync with the catalogue
 * the way a hand-maintained list does.
 *
 * Copy that genuinely is static — the "what we do" cards, the three steps, the
 * partner list — lives here as constants rather than in a CMS. That is a
 * deliberate simplification of V4, which stored this in the database and paid for
 * it with a whole content-editing surface. It can move back into the admin later
 * if the team actually wants to edit it.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCourses } from "@/server/courses/catalog";
import { listPublicPrograms } from "@/server/programs/programs";
import { formatPrice } from "@/lib/money";
import { HomeHero } from "@/components/site/HomeHero";
import {
  CourseGrid,
  CtaBanner,
  FeatureGrid,
  SectionIntro,
  type CardItem,
} from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Coding for kids",
  description:
    "CodeEarly Club teaches African kids aged 7 to 16 to code, create and lead — live classes, self-paced courses, holiday programs and competitions.",
};

export const dynamic = "force-dynamic";

const whatWeDo: CardItem[] = [
  {
    icon: "🎯",
    title: "Project-based learning",
    description:
      "Every course ends in something your child built and can show you — a game, a website, an animation. Not a certificate nobody reads.",
  },
  {
    icon: "👩🏽‍🏫",
    title: "Live classes, small groups",
    description:
      "Real instructors, paced so nobody is left behind or held back. Between classes, children work at their own speed.",
  },
  {
    icon: "🏆",
    title: "Competitions and challenges",
    description:
      "Friday quizzes, coding challenges and showcases. Children learn fastest when they are building for an audience.",
  },
  {
    icon: "🛡️",
    title: "Safe by design",
    description:
      "Parents hold the account. Children get their own restricted sign-in — lessons and quizzes only, never billing. No free-text chat.",
  },
];

const howItWorks: CardItem[] = [
  {
    icon: "1",
    title: "Create your parent account",
    description:
      "You hold the account and stay in control. Add each child as a profile — no email address needed for them.",
    tag: "2 minutes",
  },
  {
    icon: "2",
    title: "Pick courses or a program",
    description:
      "Self-paced courses to work through at home, or a holiday program with live classes and a cohort of other children.",
  },
  {
    icon: "3",
    title: "They get their own sign-in",
    description:
      "Give your child a code and PIN so they can learn independently — and you can see their progress any time.",
    tag: "Kid safe",
  },
];

const partners = ["ZERCTECH CONSULTS", "TECHEDUHUB", "RESOLVA MEDIA & IT"];

const partnerMeta: Record<string, { icon: string; type: string; color: string }> = {
  "ZERCTECH CONSULTS": { icon: "💻", type: "Technology Partner", color: "#00C896" },
  TECHEDUHUB: { icon: "🎓", type: "Education Partner", color: "#9B6DFF" },
  "RESOLVA MEDIA & IT": { icon: "📱", type: "Media & IT Partner", color: "#FF8C42" },
};

const courseIcons = ["🐱", "🌐", "🎨", "💡", "⚡", "🐍", "🤖"];

export default async function HomePage() {
  const [courses, programs] = await Promise.all([
    listPublicCourses(),
    listPublicPrograms(),
  ]);

  const featured = programs.find((p) => p.featuredOnHomepage) ?? programs[0] ?? null;

  // Derived once here so the banner's honesty is decided in one place: scarcity
  // and "registration open" are only claimed when they are actually true.
  const registrationClosed = Boolean(
    featured?.registrationDeadline && featured.registrationDeadline < new Date()
  );
  const seatsLeft =
    featured && featured.capacity !== null
      ? Math.max(0, featured.capacity - featured._count.enrollments)
      : null;

  const courseCards: CardItem[] = courses.slice(0, 6).map((course, i) => ({
    title: course.title,
    description: course.description ?? undefined,
    icon: courseIcons[i % courseIcons.length],
    tag: course.level ?? undefined,
    meta: [
      course.ageRange ? `Ages ${course.ageRange}` : null,
      course.requiresSubscription ? "Members" : formatPrice(course.priceKobo),
    ].filter(Boolean) as string[],
    href: `/courses/${course.slug}`,
  }));

  return (
    <>
      <HomeHero />

      {/* ── Featured program banner ───────────────────────────────────────────
          V4's `fpb-*` markup, so the ported CSS styles it. The countdown timer
          V4 rendered here is omitted for now: it needs a client component
          ticking to a deadline, and the banner reads correctly without it.
          Seats and the early-bird saving are shown only when genuinely true. */}
      {featured && (
        <section className="fpb-sec">
          <div
            className={featured.imageUrl ? "fpb-card fpb-card-img" : "fpb-card"}
            style={featured.imageUrl ? { backgroundImage: `url(${featured.imageUrl})` } : undefined}
          >
            {featured.imageUrl && <div className="fpb-img-overlay" />}
            <div className="fpb-glow fpb-glow-1" />
            <div className="fpb-glow fpb-glow-2" />

            <div className="fpb-content">
              <div className="fpb-info">
                <div className="fpb-eyebrow">
                  <span className="fpb-badge">☀️ {featured.type} Program</span>
                  {featured.regularPriceKobo !== null &&
                    featured.regularPriceKobo > featured.priceKobo && (
                      <span className="fpb-deal-badge">
                        🎉 Early Bird — Save{" "}
                        {formatPrice(featured.regularPriceKobo - featured.priceKobo)}!
                      </span>
                    )}
                  {!registrationClosed && <span className="fpb-live-dot">● Registration open</span>}
                </div>

                <h2 className="fpb-title">{featured.title}</h2>
                {featured.description && (
                  <p className="fpb-desc">
                    {featured.description.length > 160
                      ? `${featured.description.slice(0, 160).trimEnd()}…`
                      : featured.description}
                  </p>
                )}

                <div className="fpb-meta">
                  {featured.startDate && (
                    <span>
                      📅 Starts{" "}
                      {featured.startDate.toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {featured.ageRange && <span>🧒 Ages {featured.ageRange}</span>}
                  {featured.location && <span>💻 {featured.location}</span>}
                  <span className="fpb-price">
                    {featured.regularPriceKobo !== null &&
                      featured.regularPriceKobo > featured.priceKobo && (
                        <s className="fpb-was">{formatPrice(featured.regularPriceKobo)}</s>
                      )}
                    {formatPrice(featured.priceKobo)}
                    {featured.priceKobo ? " per child" : ""}
                  </span>
                </div>
              </div>

              <div className="fpb-cta-col">
                <Link
                  href={`/programs/${featured.id}`}
                  className={registrationClosed ? "fpb-btn fpb-btn-muted" : "fpb-btn"}
                >
                  {registrationClosed ? "View Program" : "Register Now →"}
                </Link>
                {seatsLeft !== null && seatsLeft > 0 && !registrationClosed && (
                  <p className="fpb-spaces">
                    {seatsLeft} space{seatsLeft === 1 ? "" : "s"} left!
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Partners ────────────────────────────────────────────────────────── */}
      <section className="partners-v2">
        <div className="partners-v2-inner">
          <div className="partners-v2-header">
            <span className="partners-v2-eyebrow">Our Partners</span>
            <h3 className="partners-v2-title">
              Backed by schools &amp; organizations
              <br className="partners-v2-br" /> across Nigeria
            </h3>
          </div>
          <div className="partners-v2-grid">
            {partners.map((name) => {
              const meta =
                partnerMeta[name] ?? { icon: "🤝", type: "Community Partner", color: "#36B5E8" };
              return (
                <div
                  className="partners-v2-card"
                  key={name}
                  style={{ "--partner-color": meta.color } as React.CSSProperties}
                >
                  <div className="pv2-icon-wrap">
                    <span className="pv2-icon">{meta.icon}</span>
                  </div>
                  <div className="pv2-name">{name}</div>
                  <div className="pv2-type">{meta.type}</div>
                </div>
              );
            })}
          </div>
          <div className="partners-v2-cta">
            <span>Want to partner with CodeEarly?</span>
            <Link href="/contact" className="pv2-link">
              Get in touch →
            </Link>
          </div>
        </div>
      </section>

      {/* ── What we do ──────────────────────────────────────────────────────── */}
      <section className="what fade-up visible">
        <div className="what-grid">
          <div>
            <SectionIntro
              eyebrow="What we do"
              title={
                <>
                  More than coding. We build{" "}
                  <span className="accent">confidence.</span>
                </>
              }
              subtitle="CodeEarly is a club, not a course library. Children learn alongside other children, build real things, and are seen doing it."
            />
            <br />
            <br />
            <Link className="btn-navy" href="/about">
              Our story →
            </Link>
          </div>
          <FeatureGrid items={whatWeDo} />
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="how fade-up visible">
        <div style={{ position: "relative", zIndex: 2 }}>
          <SectionIntro
            eyebrow="How it works"
            title="Three steps to becoming a SuperKoder."
            subtitle="Getting started is simple. Your child can be learning today."
          />
        </div>
        <div className="steps">
          {howItWorks.map((item) => (
            <div className="step" key={item.title}>
              <div className="sn">{item.icon}</div>
              <div className="st">{item.title}</div>
              <div className="sd">{item.description}</div>
              {item.tag ? <span className="stag">{item.tag}</span> : null}
            </div>
          ))}
        </div>
      </section>

      {/* ── Courses ─────────────────────────────────────────────────────────── */}
      {courseCards.length > 0 && (
        <section className="courses fade-up visible">
          <SectionIntro
            eyebrow="Courses"
            title={
              <>
                Learn what <span className="accent">matters</span> in tech today.
              </>
            }
            subtitle="From a first block of Scratch to writing real Python."
          />
          <CourseGrid items={courseCards} />
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link className="btn-navy" href="/courses">
              See all courses →
            </Link>
          </div>
        </section>
      )}

      <CtaBanner />
    </>
  );
}
