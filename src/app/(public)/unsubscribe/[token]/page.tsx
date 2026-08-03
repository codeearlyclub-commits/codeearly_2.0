/**
 * Unsubscribe confirmation.
 *
 * One button, no sign-in. Someone who wants off the list should never have to
 * remember a password to get there.
 */
import type { Metadata } from "next";

import { UnsubscribeButton } from "@/components/site/UnsubscribeButton";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <>
      <div className="page-hero">
        <div className="page-hero-grid" />
        <div className="page-hero-content">
          <div className="page-hero-eyebrow">Newsletter</div>
          <h1>Stop these emails?</h1>
          <p>
            One click and we&apos;ll take you off the list. You can always sign up
            again later.
          </p>
        </div>
      </div>

      <section style={{ padding: "64px 5vw", maxWidth: 560 }}>
        <UnsubscribeButton token={token} />
      </section>
    </>
  );
}
