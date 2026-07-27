/**
 * Student login management — /api/portal/children/:childId/student-login
 *
 *   POST   issue or regenerate the code + PIN
 *   DELETE turn it off
 *
 * Parent-only, and scoped to their own child by `getOwnedChild` inside the
 * service. Both operations revoke every live session for that child, so a
 * parent's "change this" or "turn this off" takes effect on the device in the
 * child's hand immediately, not when the session happens to expire.
 */
import { apiHandler } from "@/lib/api";
import { requireParent } from "@/lib/session";
import { issueStudentLogin, disableStudentLogin } from "@/server/members/child-login";
import { getOwnedChild } from "@/server/members/children";
import { sendEmail, studentLoginEmail } from "@/server/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ childId: string }> };

export const POST = apiHandler<Ctx>(async (req, ctx) => {
  const parent = await requireParent(req);
  const { childId } = await ctx.params;

  const child = await getOwnedChild(parent.userId, childId);
  const { loginCode, pin } = await issueStudentLogin(parent.userId, childId);

  // Emailed to the PARENT — a child has no address on file and should never be
  // sent credentials directly. Queued, so a mail outage cannot fail the request.
  await sendEmail({
    to: parent.email,
    ...studentLoginEmail(parent.name, child.childName, loginCode, pin),
  });

  // Returned in plaintext exactly once. There is no endpoint that can read
  // these back — only the hash is stored, and losing them means reissuing.
  return { loginCode, pin, emailedTo: parent.email };
});

export const DELETE = apiHandler<Ctx>(async (req, ctx) => {
  const parent = await requireParent(req);
  const { childId } = await ctx.params;
  await disableStudentLogin(parent.userId, childId);
  return { ok: true };
});
