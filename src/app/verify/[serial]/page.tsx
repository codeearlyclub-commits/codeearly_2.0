/**
 * Public certificate verification.
 *
 * The serial is printed on the document, so a school can check it without
 * contacting us. Deliberately PUBLIC and unauthenticated — a verification page
 * that requires an account verifies nothing for the person holding the paper.
 *
 * A revoked certificate still resolves, and says it was revoked. Hiding it would
 * make a withdrawn certificate indistinguishable from a forged one, which is the
 * opposite of what this page is for.
 *
 * What is shown is deliberately minimal: the child's first name as printed, the
 * award, the date, and the membership ID that is also on the paper. Nothing about
 * the parent, the email, or anything else the child has done.
 */
import type { Metadata } from "next";
import Link from "next/link";

import "@/styles/certificate.css";
import { verifyCertificate } from "@/server/records/reports";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ serial: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serial } = await params;
  return {
    title: `Verify certificate ${serial.toUpperCase()}`,
    description: "Check whether a CodeEarly Club certificate is genuine.",
    // Verification pages should not be indexed: they are for someone holding a
    // specific document, not a search result.
    robots: { index: false, follow: false },
  };
}

const KIND_LABEL: Record<string, string> = {
  COURSE: "Course completion",
  PROGRAM: "Program completion",
  COMPETITION: "Competition award",
};

export default async function VerifyPage({ params }: Props) {
  const { serial } = await params;
  const certificate = await verifyCertificate(serial);

  if (!certificate) {
    return (
      <main className="verify">
        <div className="verify__card verify__card--bad">
          <div className="verify__mark" aria-hidden>✕</div>
          <h1>No certificate found</h1>
          <p>
            Nothing matches the serial <code>{serial.toUpperCase()}</code>.
          </p>
          <p className="verify__note">
            Check the code on the document — it is printed near the bottom. If it
            still does not match, the certificate did not come from us.
          </p>
          <Link href="/" className="btn-secondary">
            CodeEarly Club
          </Link>
        </div>
      </main>
    );
  }

  const revoked = certificate.revokedAt !== null;

  return (
    <main className="verify">
      <div className={`verify__card ${revoked ? "verify__card--warn" : "verify__card--good"}`}>
        <div className="verify__mark" aria-hidden>
          {revoked ? "!" : "✓"}
        </div>
        <h1>{revoked ? "This certificate was withdrawn" : "Certificate verified"}</h1>
        <p className="verify__lead">
          {revoked
            ? "It was genuinely issued by CodeEarly Club, but has since been withdrawn."
            : "This certificate was issued by CodeEarly Club and is genuine."}
        </p>

        <dl className="verify__facts">
          <div>
            <dt>Awarded to</dt>
            <dd>{certificate.recipientName}</dd>
          </div>
          <div>
            <dt>For</dt>
            <dd>{certificate.title}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{KIND_LABEL[certificate.kind] ?? certificate.kind}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>
              {certificate.issuedAt.toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
          <div>
            <dt>Membership ID</dt>
            <dd><code>{certificate.child.membershipId}</code></dd>
          </div>
          <div>
            <dt>Serial</dt>
            <dd><code>{certificate.serial}</code></dd>
          </div>
        </dl>

        {revoked && (
          <p className="verify__revoked">
            <b>Reason:</b> {certificate.revokedReason}
            <br />
            <span className="verify__note">
              Withdrawn on{" "}
              {certificate.revokedAt!.toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>
        )}

        <Link href="/" className="btn-secondary">
          About CodeEarly Club
        </Link>
      </div>
    </main>
  );
}
