"use client";

/**
 * Parent sign-in.
 *
 * Children do not sign in here — they have their own page at /student, because
 * a code-and-PIN form and an email-and-password form are different shapes and
 * merging them would confuse both audiences.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const result = await signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    setPending(false);
    if (result.error) {
      // Better Auth distinguishes "unverified" from "wrong credentials", and
      // that one IS worth surfacing — otherwise a parent who never clicked the
      // link has no idea why a correct password is being rejected.
      setError(result.error.message ?? "That email or password isn't right.");
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <main className="auth-card">
      <h1>Sign in</h1>

      <form onSubmit={onSubmit}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>

        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>

        {error && <p role="alert" className="error">{error}</p>}

        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="muted">
        New here? <Link href="/register">Create an account</Link>
      </p>
      <p className="muted">
        Are you a student? <Link href="/student">Sign in with your code</Link>
      </p>
    </main>
  );
}
