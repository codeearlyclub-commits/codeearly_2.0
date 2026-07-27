/**
 * Parent account — profile summary and sign-out.
 *
 * Thin on purpose: password change, email change and 2FA all go through Better
 * Auth's own endpoints and land here in Phase 2, once there is billing worth
 * protecting.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <main className="portal">
      <header className="portal-header">
        <h1>Your account</h1>
        <Link href="/portal" className="muted">
          Back to portal
        </Link>
      </header>

      <p>
        <b>{session.user.name}</b>
        <br />
        <span className="muted">{session.user.email}</span>
      </p>

      <p className="muted">
        Email {session.user.emailVerified ? "confirmed" : "not confirmed yet"}.
      </p>

      <SignOutButton />
    </main>
  );
}
