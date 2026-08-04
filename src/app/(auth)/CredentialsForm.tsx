"use client";

/**
 * Email + password sign-in, shared by the parent door and the staff door.
 *
 * One component because the credentials genuinely are the same — the doors
 * differ in where they land and what they say, not in what they check. Having
 * two copies would mean two places to get the child-session eviction wrong.
 *
 * That eviction is the important part: before signing a parent in, any child
 * session in this browser is ended properly, server-side, via
 * /api/student/logout. Middleware also drops the cookie as a backstop, but only
 * this revokes the session row — the difference matters if the token was ever
 * captured.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { signIn } from "@/lib/auth-client";

export function CredentialsForm({
  destination,
  submitLabel = "Sign in",
}: {
  destination: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);

    // Best-effort and deliberately not awaited into a failure path: if there is
    // no child session this is a no-op, and if it fails the middleware still
    // clears the cookie. Blocking a parent's sign-in on it would be worse.
    await fetch("/api/student/logout", { method: "POST" }).catch(() => {});

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

    router.push(destination);
    router.refresh();
  }

  return (
    <form className="auth__form" onSubmit={onSubmit}>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" autoFocus />
      </label>

      <label>
        Password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>

      {error && (
        <p role="alert" className="auth__error">
          {error}
        </p>
      )}

      <button className="auth__submit" type="submit" disabled={pending}>
        {pending ? "Signing in…" : submitLabel}
      </button>
    </form>
  );
}
