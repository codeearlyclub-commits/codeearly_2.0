/**
 * The printable certificate.
 *
 * A real page rather than a generated PDF, for three reasons: no PDF library to
 * install or keep patched, nothing to store (so no stale copy and nothing to
 * leak), and Ctrl+P produces a proper A4 landscape document via the print
 * stylesheet. A parent's instinct with a certificate is to print it, so the print
 * output IS the deliverable.
 *
 * Public, like the verification page — the serial is on the paper, and a page
 * requiring a login is useless to a school checking it.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import "@/styles/certificate.css";
import { verifyCertificate } from "@/server/records/reports";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ serial: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serial } = await params;
  const certificate = await verifyCertificate(serial);
  return {
    title: certificate ? `${certificate.title} — ${certificate.recipientName}` : "Certificate",
    robots: { index: false, follow: false },
  };
}

export default async function CertificatePage({ params }: Props) {
  const { serial } = await params;
  const certificate = await verifyCertificate(serial);
  if (!certificate) notFound();

  const revoked = certificate.revokedAt !== null;

  return (
    <main className="cert-page">
      <div className="cert-toolbar">
        <Link className="btn-secondary" href={`/verify/${certificate.serial}`}>
          Verification page
        </Link>
        <PrintButton />
      </div>

      <article className={`cert${revoked ? " cert--revoked" : ""}`}>
        <p className="cert__eyebrow">CodeEarly Club</p>
        <h1 className="cert__title">Certificate of Completion</h1>

        <p className="cert__presented">This is presented to</p>
        <p className="cert__name">{certificate.recipientName}</p>

        <p className="cert__for">
          for successfully completing{" "}
          <span className="cert__course">{certificate.title}</span>
          {certificate.kind === "COURSE" && " — every lesson, start to finish."}
          {certificate.kind === "PROGRAM" && " — attending and completing the programme."}
          {certificate.kind === "COMPETITION" && " — and their achievement in the competition."}
        </p>

        <div className="cert__foot">
          <div>
            <b>
              {certificate.issuedAt.toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </b>
            Date issued
          </div>
          <div>
            <b>{certificate.child.membershipId}</b>
            Membership ID
          </div>
          <div>
            {/* Printed so anyone holding the paper can check it independently. */}
            <b className="cert__serial">{certificate.serial}</b>
            Verify at codeearly.com/verify
          </div>
        </div>
      </article>
    </main>
  );
}
