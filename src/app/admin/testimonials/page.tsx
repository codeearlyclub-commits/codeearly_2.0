import { listAllTestimonials } from "@/server/content/content";
import { TestimonialsAdmin } from "./TestimonialsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const testimonials = await listAllTestimonials();

  return (
    <>
      <header className="admin__head">
        <h1>Testimonials</h1>
        <p className="muted">
          Shown on the homepage in the order below. Only publish what a parent
          actually said — the section stays hidden rather than filled with invented
          copy.
        </p>
      </header>

      <TestimonialsAdmin
        testimonials={testimonials.map((t) => ({
          id: t.id,
          quote: t.quote,
          author: t.author,
          role: t.role,
          status: t.status,
          order: t.order,
        }))}
      />
    </>
  );
}
