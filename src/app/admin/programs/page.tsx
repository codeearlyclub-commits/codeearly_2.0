import { listAllPrograms } from "@/server/programs/admin";
import { ProgramsAdmin } from "./ProgramsAdmin";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function AdminProgramsPage() {
  const programs = await listAllPrograms();

  return (
    <>
      <header className="admin__head">
        <h1>Programs</h1>
        <p className="muted">
          Cohort offerings with live sessions and limited seats. Capacity cannot
          be lowered below the number of children already registered.
        </p>
      </header>

      <ProgramsAdmin
        initial={programs.map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          description: p.description,
          ageRange: p.ageRange,
          location: p.location,
          status: p.status,
          featuredOnHomepage: p.featuredOnHomepage,
          priceKobo: p.priceKobo,
          regularPriceKobo: p.regularPriceKobo,
          capacity: p.capacity,
          seatsTaken: p.seatsTaken,
          registered: p._count.enrollments,
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
          registrationDeadline: toDateInput(p.registrationDeadline),
          sessions: p.sessions.map((s) => ({
            title: s.title,
            date: s.date.toISOString().slice(0, 10),
            virtualLink: s.virtualLink,
          })),
        }))}
      />
    </>
  );
}
