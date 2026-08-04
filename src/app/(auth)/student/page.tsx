"use client";

/**
 * Student sign-in — the child-facing door.
 *
 * Written for a young child on a shared device: two short fields, big targets,
 * numeric keypad for the PIN, and no jargon. There is no "forgot my PIN" link
 * because there is no recovery flow for a child — a parent reissues it, which
 * is the point of the design.
 *
 * Signing in here ENDS any parent session in this browser. That is handled
 * server-side by /api/student/login, and it is the whole reason a child can be
 * handed the family laptop safely: they cannot walk from here into billing.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { AuthBrand } from "../AuthBrand";

export default function StudentLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginCode: String(form.get("loginCode") ?? "").trim().toUpperCase(),
        pin: String(form.get("pin") ?? "").trim(),
      }),
    });

    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "That code or PIN isn't right.");
      return;
    }

    router.push("/me");
    router.refresh();
  }

  return (
    <main className="auth auth--kid">
      <AuthBrand />

      <div className="auth__card">
        <h1>Hello! 👋</h1>
        <p className="auth__lede">Type the code and PIN your parent gave you.</p>

        <form className="auth__form" onSubmit={onSubmit}>
          <label>
            Your code
            <input
              className="auth__kidfield"
              name="loginCode"
              type="text"
              required
              maxLength={6}
              minLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABC123"
              style={{ textTransform: "uppercase" }}
              autoFocus
            />
          </label>

          <label>
            Your PIN
            <input
              className="auth__kidfield"
              name="pin"
              // inputMode numeric brings up the number pad on a tablet without
              // the spinner arrows a number input would add.
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              maxLength={4}
              minLength={4}
              autoComplete="off"
              placeholder="••••"
            />
          </label>

          {error && (
            <p role="alert" className="auth__error">
              {error}
            </p>
          )}

          <button className="auth__submit" type="submit" disabled={pending}>
            {pending ? "Checking…" : "Let's go!"}
          </button>
        </form>

        <p className="auth__kidhint">
          Lost your code or PIN? Ask your parent — they can make you a new one.
        </p>
        <p className="auth__kidhint">
          <Link href="/login">Not a student?</Link>
        </p>
      </div>
    </main>
  );
}
