"use client";

/**
 * Student sign-in — the child-facing page.
 *
 * Written for a young child on a shared device: two short fields, big targets,
 * numeric keypad for the PIN, and no jargon. There is no "forgot my PIN" link
 * because there is no recovery flow for a child — a parent reissues it, which
 * is the point of the design.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="auth-card">
      <h1>Hello! Sign in to learn</h1>
      <p className="muted">Type the code and PIN your parent gave you.</p>

      <form onSubmit={onSubmit}>
        <label>
          Your code
          <input
            name="loginCode"
            type="text"
            required
            maxLength={6}
            minLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC123"
            style={{ textTransform: "uppercase", letterSpacing: "0.25em", fontSize: "1.5rem" }}
          />
        </label>

        <label>
          Your PIN
          <input
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
            style={{ letterSpacing: "0.5em", fontSize: "1.5rem" }}
          />
        </label>

        {error && <p role="alert" className="error">{error}</p>}

        <button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Let's go"}
        </button>
      </form>

      <p className="muted">
        Lost your code or PIN? Ask your parent — they can make you a new one.
      </p>
    </main>
  );
}
