import { listAllFaqs } from "@/server/content/content";
import { FaqsAdmin } from "./FaqsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const faqs = await listAllFaqs();

  return (
    <>
      <header className="admin__head">
        <h1>FAQs</h1>
        <p className="muted">
          Published questions appear on <code>/faq</code>, grouped by category in
          this order.
        </p>
      </header>

      <FaqsAdmin
        faqs={faqs.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          category: f.category,
          status: f.status,
          order: f.order,
        }))}
      />
    </>
  );
}
