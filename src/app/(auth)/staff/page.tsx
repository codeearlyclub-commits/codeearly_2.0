/**
 * Staff sign-in.
 *
 * Same credentials as a parent — a staff member is a User with role "admin" —
 * but its own door, its own look, and it lands on /admin.
 *
 * It does NOT check the role before signing in, and it does not tell a
 * non-admin that they are not staff. Doing either would turn this page into an
 * oracle for "is this address an administrator?", which is exactly the question
 * someone probing the site wants answered. A non-admin who signs in here simply
 * arrives at /admin and is redirected to the portal, the same as if the admin
 * route did not exist.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { AuthBrand } from "../AuthBrand";
import { CredentialsForm } from "../CredentialsForm";

export const metadata: Metadata = {
  title: "Staff sign-in",
  robots: { index: false, follow: false },
};

export default function StaffLoginPage() {
  return (
    <main className="auth auth--staff">
      {/* The staff door is navy, so the logo needs its light chip. */}
      <AuthBrand onDark />

      <div className="auth__card">
        <h1>Staff sign-in</h1>
        <p className="auth__lede">CodeEarly team only.</p>

        <CredentialsForm destination="/admin" submitLabel="Sign in to admin" />

        <div className="auth__alt">
          <span>
            Not staff? <Link href="/login">Sign in here instead</Link>
          </span>
        </div>
      </div>
    </main>
  );
}
