"use client";

import { useState } from "react";
import Link from "next/link";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  if (state === "done") {
    return (
      <div className="form-card">
        <h2 style={{ fontSize: 20, marginBottom: 10 }}>You&apos;re unsubscribed.</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          We won&apos;t email you the newsletter again. Anything to do with your
          account — receipts, class reminders — still comes through, because those
          aren&apos;t marketing.
        </p>
        <p style={{ marginTop: 18 }}>
          <Link href="/">Back to CodeEarly →</Link>
        </p>
      </div>
    );
  }

  async function unsubscribe() {
    setState("sending");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setMessage(data.error?.message ?? "That link didn't work. Please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setMessage("We couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  }

  return (
    <div className="form-card">
      {state === "error" && (
        <p role="alert" style={{ color: "#E24B4A", fontSize: 13, marginBottom: 14 }}>
          {message}
        </p>
      )}
      <button className="btn-primary" onClick={unsubscribe} disabled={state === "sending"}>
        {state === "sending" ? "Unsubscribing…" : "Yes, unsubscribe me"}
      </button>
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
        Changed your mind? <Link href="/">Just close this page.</Link>
      </p>
    </div>
  );
}
