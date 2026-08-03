"use client";

/**
 * Footer newsletter signup.
 *
 * The success message is the same whether the address was new or already on the
 * list — see the API route for why. Nothing here reveals who is subscribed.
 */
import { useState } from "react";

export function NewsletterSignup() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          website: String(form.get("website") ?? ""),
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage(data.error?.message ?? "That didn't work. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setMessage("We couldn't reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="footer-desc" style={{ marginTop: 8 }}>
        ✅ You&apos;re on the list. Look out for us in your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="form-input"
          type="email"
          name="email"
          required
          maxLength={160}
          placeholder="you@example.com"
          aria-label="Email address for the newsletter"
          style={{
            flex: "1 1 180px",
            minWidth: 0,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
          }}
        />
        {/* Honeypot. */}
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
        />
        <button className="btn-primary" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "…" : "Sign up"}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" style={{ color: "#ff8b8b", fontSize: 12, marginTop: 8 }}>
          {message}
        </p>
      )}
    </form>
  );
}
