"use client";

import { useState } from "react";

/**
 * Contact form.
 *
 * The `website` field is a honeypot: hidden from people, filled in by naive
 * bots. It is hidden with off-screen positioning rather than `display:none`,
 * because some bots skip fields that are display-none — and `tabIndex={-1}`
 * plus `aria-hidden` keeps it away from keyboard and screen-reader users.
 */
export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState("sending");

    const data = new FormData(e.currentTarget);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        message: String(data.get("message") ?? ""),
        website: String(data.get("website") ?? ""),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error?.fields
          ? Object.values(body.error.fields).flat().join(" ")
          : (body?.error?.message ?? "We couldn't send that. Please try again.")
      );
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="notice">
        <h2>Thank you — message received</h2>
        <p>We&apos;ll reply to the email address you gave us, usually within a day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="contact-form">
      <label>
        Your name
        <input name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" />
      </label>

      <label>
        Email
        <input name="email" type="email" required maxLength={160} autoComplete="email" />
      </label>

      <label>
        Phone <span className="muted">(optional)</span>
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>

      <label>
        How can we help?
        <textarea name="message" required minLength={10} maxLength={2000} rows={6} />
      </label>

      <div className="honeypot" aria-hidden="true">
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      <button type="submit" className="btn btn--primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
