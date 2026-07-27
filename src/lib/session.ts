/**
 * Session resolution — who is making this request?
 *
 * Three distinct identities, deliberately never interchangeable:
 *
 *   parent  — a Better Auth `User`. Owns billing, children, account settings.
 *   child   — a restricted Redis session (see lib/child-session.ts). No user row.
 *   admin   — a parent whose `role` is "admin". CodeEarly staff.
 *
 * Every route states which it requires. There is no "get the current user and
 * figure it out later" helper, because that is exactly how a child session ends
 * up satisfying a check that meant to require a parent.
 */
import { auth } from "@/lib/auth";
import { errors } from "@/lib/errors";
import { childTokenFromRequest, getChildSession, type ChildSession } from "@/lib/child-session";

export type ParentSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
};

/**
 * Resolve a parent session from cookies (web) or a bearer token (mobile).
 * Better Auth's bearer plugin handles both, so this is one code path.
 */
export async function getParentSession(req: Request): Promise<ParentSession | null> {
  const result = await auth.api.getSession({ headers: req.headers });
  if (!result?.user) return null;
  const user = result.user as typeof result.user & { role?: string };
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? "user",
    emailVerified: Boolean(user.emailVerified),
  };
}

export async function requireParent(req: Request): Promise<ParentSession> {
  const session = await getParentSession(req);
  if (!session) throw errors.unauthenticated();
  return session;
}

/**
 * A parent who has confirmed their email.
 *
 * Used for anything that spends money, sends mail, or creates records other
 * people will see — an unverified address is an unowned account.
 */
export async function requireVerifiedParent(req: Request): Promise<ParentSession> {
  const session = await requireParent(req);
  if (!session.emailVerified) {
    throw errors.forbidden("Please confirm your email address first.");
  }
  return session;
}

export async function requireAdmin(req: Request): Promise<ParentSession> {
  const session = await requireParent(req);
  if (session.role !== "admin") {
    // Same message a non-admin sees everywhere else — admin routes should not
    // announce their own existence to a signed-in parent poking at URLs.
    throw errors.forbidden("You do not have access to this.");
  }
  return session;
}

/** Resolve a child's restricted session, if one is present. */
export async function getChild(req: Request): Promise<ChildSession | null> {
  return getChildSession(childTokenFromRequest(req));
}

export async function requireChild(req: Request): Promise<ChildSession> {
  const session = await getChild(req);
  if (!session) throw errors.unauthenticated();
  return session;
}

/**
 * For portal pages a child OR their parent may open (lessons, own report card).
 *
 * Returns which one it is, so the handler can widen or narrow what it shows —
 * a parent sees every child, a child sees only themselves. The caller must
 * branch on `kind`; there is no merged "user id" that hides the difference.
 */
export async function requireParentOrChild(
  req: Request
): Promise<
  | { kind: "parent"; parent: ParentSession }
  | { kind: "child"; child: ChildSession }
> {
  const parent = await getParentSession(req);
  if (parent) return { kind: "parent", parent };

  const child = await getChild(req);
  if (child) return { kind: "child", child };

  throw errors.unauthenticated();
}
