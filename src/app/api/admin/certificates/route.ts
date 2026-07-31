/**
 * Certificates: POST (issue outstanding for a child) / PATCH (revoke)
 *
 * There is no DELETE. A certificate that has been printed and framed cannot be
 * un-issued by removing a database row — the paper still exists, and someone may
 * try to verify it. Revocation keeps the serial verifiable and says it was
 * withdrawn, which is the honest answer.
 */
import { z } from "zod";

import { apiHandler, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { issueOutstandingCertificates, revokeCertificate } from "@/server/records/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(req, z.object({ childId: z.string().min(1) }));

  // Idempotent: safe to press twice, and safe to run as a batch.
  const issued = await issueOutstandingCertificates(body.childId);
  return { count: issued.length, serials: issued.map((c) => c.serial) };
});

export const PATCH = apiHandler(async (req) => {
  await requireAdmin(req);
  const body = await parseBody(
    req,
    z.object({ id: z.string().min(1), reason: z.string().trim().min(3).max(300) })
  );

  const certificate = await revokeCertificate(body.id, body.reason);
  return { serial: certificate.serial, revokedAt: certificate.revokedAt };
});
