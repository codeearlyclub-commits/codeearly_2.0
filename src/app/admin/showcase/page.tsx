/**
 * Student showcase — staff view.
 */
import { listAllShowcase } from "@/server/content/content";
import { ShowcaseAdmin } from "./ShowcaseAdmin";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminShowcasePage() {
  const projects = await listAllShowcase();

  return (
    <>
      <header className="admin__head">
        <h1>Student showcase</h1>
        <p className="muted">
          Public pages about children. First names only, and nothing is published
          without recorded parental consent — the database refuses it.
        </p>
      </header>

      <ShowcaseAdmin
        projects={projects.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          description: p.description,
          childFirstName: p.childFirstName,
          childAge: p.childAge,
          mediaUrl: p.mediaUrl,
          projectUrl: p.projectUrl,
          tags: p.tags,
          featured: p.featured,
          status: p.status,
          consentBy: p.consentBy,
          consentGivenAt: p.consentGivenAt ? dateFmt.format(p.consentGivenAt) : null,
        }))}
      />
    </>
  );
}
