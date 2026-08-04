/**
 * The one sign-in door on the website.
 *
 * WHY A CHOOSER RATHER THAN ONE FORM
 *
 * A parent signs in with an email and a password. A child signs in with a
 * six-character code and a four-digit PIN, issued by their parent, with no
 * email address anywhere. Those are not two skins on one form — they are
 * different credentials, different validation, different recovery (a child has
 * none; their parent reissues), and different readers, one of whom is seven.
 *
 * Merging them produces a form that asks a child for something they do not have
 * and a parent for something they were never given. So the site has one place to
 * start, and it asks who you are first.
 *
 * A server component: if this browser already holds a session it says so, rather
 * than presenting a blank form to someone who is in fact already signed in.
 */
import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { getChildSession, CHILD_SESSION_COOKIE } from "@/lib/child-session";
import { AuthBrand } from "../AuthBrand";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to CodeEarly Club — parents, students and staff.",
};

export const dynamic = "force-dynamic";

export default async function LoginChooserPage() {
  const [session, jar] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    cookies(),
  ]);
  const child = await getChildSession(jar.get(CHILD_SESSION_COOKIE)?.value);

  return (
    <main className="auth">
      <AuthBrand />

      <div className="auth__card">
        <h1>Welcome back</h1>
        <p className="auth__lede">Who&apos;s signing in?</p>

        {/* Told, not silently overridden. Signing in as one audience ends the
            other's session, and someone should know that before they do it. */}
        {child && (
          <p className="auth__switch">
            <span aria-hidden>👋</span>
            <span>
              <b>{child.displayName}</b> is signed in on this device.{" "}
              <Link href="/me">Go to their lessons</Link>, or sign in below to
              switch — that will sign them out.
            </span>
          </p>
        )}

        {!child && session?.user && (
          <p className="auth__switch">
            <span aria-hidden>👋</span>
            <span>
              You&apos;re signed in as <b>{session.user.email}</b>.{" "}
              <Link href="/portal">Go to your portal</Link>.
            </span>
          </p>
        )}

        <div className="auth__choices">
          <Link
            className="auth__choice"
            href="/login/parent"
            style={{ "--tint-bg": "var(--green-light)" } as React.CSSProperties}
          >
            <span className="auth__choice-icon" aria-hidden>
              👩🏽
            </span>
            <span className="auth__choice-main">
              <span className="auth__choice-title">I&apos;m a parent</span>
              <span className="auth__choice-sub">
                Sign in with your email and password to manage your children,
                courses and payments.
              </span>
            </span>
            <span className="auth__choice-arrow" aria-hidden>
              →
            </span>
          </Link>

          <Link
            className="auth__choice"
            href="/student"
            style={{ "--tint-bg": "var(--purple-light)" } as React.CSSProperties}
          >
            <span className="auth__choice-icon" aria-hidden>
              🧒🏽
            </span>
            <span className="auth__choice-main">
              <span className="auth__choice-title">I&apos;m a student</span>
              <span className="auth__choice-sub">
                Use the code and PIN your parent gave you. No email needed.
              </span>
            </span>
            <span className="auth__choice-arrow" aria-hidden>
              →
            </span>
          </Link>
        </div>

        <p className="auth__staff">
          New to CodeEarly? <Link href="/register">Create a parent account</Link>
          <br />
          <span style={{ opacity: 0.75 }}>
            CodeEarly staff? <Link href="/staff">Sign in here</Link>
          </span>
        </p>
      </div>
    </main>
  );
}
