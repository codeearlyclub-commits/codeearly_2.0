/**
 * Parent sign-in.
 *
 * Lands on /portal — always, even for staff. Someone who chose "I'm a parent"
 * asked for the portal; quietly routing an admin to /admin instead would be the
 * software deciding it knows better. Staff have their own door at /staff.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { AuthBrand } from "../../AuthBrand";
import { CredentialsForm } from "../../CredentialsForm";

export const metadata: Metadata = {
  title: "Parent sign-in",
  description: "Sign in to your CodeEarly Club parent account.",
};

export default function ParentLoginPage() {
  return (
    <main className="auth">
      <AuthBrand />

      <div className="auth__card">
        <h1>Parent sign-in</h1>
        <p className="auth__lede">
          Manage your children, their courses and your payments.
        </p>

        <CredentialsForm destination="/portal" />

        <div className="auth__alt">
          <span>
            New here? <Link href="/register">Create an account</Link>
          </span>
          <span>
            Signing in as a student? <Link href="/student">Use your code and PIN</Link>
          </span>
          <span>
            Forgotten your password? <Link href="/contact">Message us</Link> and we&apos;ll
            reset it — self-service reset is coming shortly.
          </span>
        </div>
      </div>
    </main>
  );
}
