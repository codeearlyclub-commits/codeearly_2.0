"use client";

/**
 * Parent sign-up.
 *
 * Parents register; children never do. The form asks for the parent's own name
 * and email because the account is theirs — children are added afterwards, from
 * inside the portal.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signUp } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const result = await signUp.email({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "We couldn't create that account.");
      return;
    }
    // Verification is required before sign-in, so land on a "check your email"
    // state rather than pretending they're logged in.
    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <main className="auth-card">
        <h1>Check your email</h1>
        <p>
          We&apos;ve sent you a link to confirm your address. Click it and you can
          sign in and add your children.
        </p>
        <p className="muted">
          Nothing arrived? Check your spam folder, or{" "}
          <Link href="/login">try signing in</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-card">
      <h1>Create your parent account</h1>
      <p className="muted">
        You&apos;ll add your children once you&apos;re in — they get their own
        sign-in later.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Your name
          <input name="name" type="text" required autoComplete="name" minLength={2} />
        </label>

        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
          />
          <small className="muted">At least 8 characters.</small>
        </label>

        {error && <p role="alert" className="error">{error}</p>}

        <button type="submit" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="muted">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
