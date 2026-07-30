/**
 * Home hero — ported from the live V4 site.
 *
 * Class names match V4's `hhv2-*` exactly so `site-v4.css` renders it
 * identically. Two deliberate changes:
 *
 *  1. **No framer-motion.** V4 animated this with framer-motion; here the same
 *     entrances, floats and spring-ish pops are CSS (see site-anim.css). The
 *     motion library would add 100KB+ of JavaScript to the first paint of a
 *     marketing page whose audience is largely on Nigerian mobile networks.
 *  2. **The hero image is self-hosted.** V4 hot-linked Unsplash on every load;
 *     the same image now sits in /public, so there is no third-party request
 *     blocking the largest element on the page.
 *
 * A consequence worth noting: this is now a SERVER component. V4's was a client
 * component solely because framer-motion required it, so removing the library
 * removes the JavaScript for the hero entirely.
 */
import Image from "next/image";
import Link from "next/link";

const floatingDecor = [
  { emoji: "🚀", style: { top: "12%", right: "8%", fontSize: 36 }, delay: "0.9s", dur: "3s" },
  { emoji: "⭐", style: { top: "22%", right: "42%", fontSize: 22 }, delay: "1.2s", dur: "3.4s" },
  { emoji: "💻", style: { bottom: "28%", right: "6%", fontSize: 30 }, delay: "1.4s", dur: "3.8s" },
  { emoji: "🎯", style: { top: "58%", right: "36%", fontSize: 20 }, delay: "0.7s", dur: "4.2s" },
  { emoji: "🏆", style: { bottom: "16%", right: "48%", fontSize: 26 }, delay: "1.1s", dur: "4.6s" },
  { emoji: "✨", style: { top: "35%", left: "4%", fontSize: 18 }, delay: "1.3s", dur: "5s" },
];

const achievementCards = [
  { icon: "🏅", label: "Challenge Winner!", sub: "+200 XP earned", pos: { top: "8%", right: "-4%" }, delay: "0.9s" },
  { icon: "👥", label: "500+ young coders", sub: "Across Nigeria", pos: { bottom: "26%", left: "-6%" }, delay: "1.1s" },
  { icon: "📅", label: "Weekend Meetup", sub: "Saturday · 10am", pos: { top: "56%", right: "-8%" }, delay: "1.3s" },
];

const stats = [
  { value: "5,000+", label: "Kids enrolled" },
  { value: "10+", label: "Courses" },
  { value: "15", label: "Max age" },
  { value: "100%", label: "Kid safe" },
];

export type HeroCopy = {
  eyebrow?: string;
  subtitle?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export function HomeHero({ hero = {} }: { hero?: HeroCopy }) {
  return (
    <section className="home-hero-v2">
      <div className="hhv2-bg" />
      <div className="hhv2-grid" />

      {floatingDecor.map((d, i) => (
        <div
          key={i}
          className="hhv2-decor ce-anim ce-pop"
          style={
            {
              ...d.style,
              animationDelay: d.delay,
              // The float runs as a second animation on the same element via a
              // separate property (`translate`), so it does not clobber the
              // entrance transform.
              animation: undefined,
            } as React.CSSProperties
          }
        >
          <span
            className="ce-float"
            style={{ display: "inline-block", animationDuration: d.dur, animationDelay: d.delay }}
          >
            {d.emoji}
          </span>
        </div>
      ))}

      {/* ── Left: the words ─────────────────────────────────────────────────── */}
      <div className="hhv2-left">
        <div className="hhv2-eyebrow ce-anim ce-rise-sm ce-d1">
          <span className="hhv2-dot" />
          {hero.eyebrow || "Coding Club for African Kids · Ages 7–15"}
        </div>

        <h1 className="hhv2-h1 ce-anim ce-rise ce-d2">
          Start your coding
          <br />
          journey <span className="hhv2-accent">early.</span>
          <br />
          <span className="hhv2-gold">Build the future.</span>
        </h1>

        <p className="hhv2-sub ce-anim ce-rise-sm ce-d3">
          {hero.subtitle ||
            "Join 5,000+ kids across Nigeria learning real coding skills, competing in challenges, and building projects that matter."}
        </p>

        <div className="hhv2-btns ce-anim ce-rise-sm ce-d4">
          <Link href={hero.primary?.href ?? "/register"} className="hhv2-btn-primary">
            {hero.primary?.label ?? "Join the Club"} →
          </Link>
          <Link href={hero.secondary?.href ?? "/courses"} className="hhv2-btn-secondary">
            {hero.secondary?.label ?? "Explore Courses"}
          </Link>
        </div>

        {/* V4 counted these up with JavaScript. Rendered directly instead: the
            number is the point, and an animated count is invisible to anyone who
            scrolls past it in under two seconds. */}
        <div className="hhv2-stats ce-anim ce-fade ce-d5">
          {stats.map((s) => (
            <div className="hhv2-stat" key={s.label}>
              <div className="hhv2-stat-n">{s.value}</div>
              <div className="hhv2-stat-l">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="hhv2-proof ce-anim ce-rise-sm ce-d6">
          <div className="hhv2-avatars">
            {["E", "T", "A", "K", "O"].map((letter, i) => (
              <div
                key={letter}
                className="hhv2-av"
                style={{
                  background: ["#00C896", "#9B6DFF", "#FF8C42", "#36B5E8", "#FF6B9D"][i],
                }}
              >
                {letter}
              </div>
            ))}
          </div>
          <span className="hhv2-proof-text">
            Joined by <strong>5,000+</strong> young coders this year
          </span>
        </div>
      </div>

      {/* ── Right: the picture ──────────────────────────────────────────────── */}
      <div className="hhv2-right ce-anim ce-slide-in ce-d1">
        <div className="hhv2-img-wrap">
          <Image
            src="/hero-coder.jpg"
            alt="A young girl learning to code on a laptop"
            width={560}
            height={420}
            className="hhv2-img"
            priority
          />
          <div className="hhv2-img-overlay" />

          {achievementCards.map((card) => (
            <div
              key={card.label}
              className="hhv2-float-card ce-anim ce-pop"
              style={{ ...(card.pos as React.CSSProperties), animationDelay: card.delay }}
            >
              <span className="ce-float" style={{ display: "contents", animationDelay: card.delay }}>
                <div className="hhv2-fc-icon">{card.icon}</div>
                <div>
                  <div className="hhv2-fc-label">{card.label}</div>
                  <div className="hhv2-fc-sub">{card.sub}</div>
                </div>
              </span>
            </div>
          ))}

          <div className="hhv2-xp-badge ce-anim ce-pop-rot ce-d8">
            <div className="hhv2-xp-inner">
              <div className="hhv2-xp-num">650</div>
              <div className="hhv2-xp-label">XP</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
