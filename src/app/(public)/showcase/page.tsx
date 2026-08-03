/**
 * Student showcase — V4's design, live data.
 *
 * SAFEGUARDING NOTE, and it is the reason this page is short:
 *
 * Everything here is public and about a child. So the page shows a FIRST NAME
 * and an age, never a surname, a school, a city or a face we host. The database
 * refuses to mark an entry PUBLISHED unless parental consent was recorded with
 * a name and a timestamp — see the `showcase_published_needs_consent` CHECK
 * constraint. This page therefore cannot show an unconsented child even if
 * someone tried to make it.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { listPublicShowcase } from "@/server/content/content";
import { CtaBanner } from "@/components/site/SitePrimitives";

export const metadata: Metadata = {
  title: "Student Showcase",
  description:
    "Games, websites and animations built by CodeEarly Club members aged 7 to 16.",
};

export const dynamic = "force-dynamic";

/** A stable colour per project, so the grid isn't a wall of one shade. */
const mediaGradients = [
  "linear-gradient(135deg,#1A3C6E,#2454A0)",
  "linear-gradient(135deg,#0A6E50,#00C896)",
  "linear-gradient(135deg,#4A2080,#9B6DFF)",
  "linear-gradient(135deg,#0A5566,#00B8D4)",
  "linear-gradient(135deg,#8B5A00,#F5A623)",
  "linear-gradient(135deg,#7A2020,#FF6B6B)",
];

const projectIcons = ["🎮", "🌐", "🎨", "🤖", "📱", "🧩"];

export default async function ShowcasePage() {
  const projects = await listPublicShowcase();

  const ages = projects.map((p) => p.childAge).filter((a): a is number => a !== null);
  const youngest = ages.length > 0 ? Math.min(...ages) : null;

  return (
    <>
      <div className="showcase-hero">
        <div className="showcase-hero-grid" />
        <div className="showcase-hero-blob showcase-hero-blob-right" />
        <div className="showcase-hero-blob showcase-hero-blob-left" />
        <div className="showcase-hero-content">
          <div className="showcase-eyebrow">🏆 Built by our members</div>
          <h1>
            Look what they <span className="ac">made</span>.
          </h1>
          <p>
            Every project here was built by a CodeEarly Club member — from a first
            Scratch game to a working website. Shared with their parents&apos;
            permission.
          </p>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="showcase-stats-bar">
          <div className="showcase-stat-item">
            <div className="showcase-stat-num">{projects.length}</div>
            <div className="showcase-stat-lbl">Projects shared</div>
          </div>
          {youngest !== null && (
            <div className="showcase-stat-item">
              <div className="showcase-stat-num">{youngest}</div>
              <div className="showcase-stat-lbl">Youngest builder</div>
            </div>
          )}
          <div className="showcase-stat-item">
            <div className="showcase-stat-num">{projects.filter((p) => p.featured).length}</div>
            <div className="showcase-stat-lbl">Featured</div>
          </div>
        </div>
      )}

      <section className="showcase-section">
        {projects.length === 0 ? (
          <div className="showcase-empty">
            <div className="showcase-empty-inner">
              <div className="showcase-empty-icon">🚀</div>
              <h2 className="section-title">The first projects are being built</h2>
              <p style={{ marginBottom: 24 }}>
                Our members are working on them right now. Come back soon — or join
                the club and put your child&apos;s project here.
              </p>
              <Link className="btn-primary" href="/register">
                Join the Club →
              </Link>
            </div>
          </div>
        ) : (
          <div className="showcase-grid">
            {projects.map((project, i) => {
              const card = (
                <>
                  <div
                    className="card-media"
                    style={{ background: mediaGradients[i % mediaGradients.length] }}
                  >
                    <div className="card-media-placeholder">
                      {projectIcons[i % projectIcons.length]}
                    </div>
                    <span className="card-type ct-project">Project</span>
                    {project.featured && <span className="featured-badge">Featured</span>}
                  </div>
                  <div className="card-body">
                    <div className="card-student">
                      {/* First initial only — the avatar must not become a way to
                          infer more than the page already shows. */}
                      <div className="student-av">
                        {project.childFirstName.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="student-name">{project.childFirstName}</div>
                        {project.childAge !== null && (
                          <div className="student-age">Age {project.childAge}</div>
                        )}
                      </div>
                    </div>
                    <div className="card-title">{project.title}</div>
                    {project.description && (
                      <div className="card-desc">{project.description}</div>
                    )}
                    {project.tags.length > 0 && (
                      <div className="card-tags">
                        {project.tags.map((tag) => (
                          <span className="tag" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );

              // Links out are `noopener noreferrer` — a child's project may be
              // hosted on Scratch or GitHub Pages, and neither should get a
              // handle on our window.
              return project.projectUrl ? (
                <a
                  className="showcase-card"
                  key={project.id}
                  href={project.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  {card}
                </a>
              ) : (
                <article className="showcase-card" key={project.id}>
                  {card}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CtaBanner />
    </>
  );
}
