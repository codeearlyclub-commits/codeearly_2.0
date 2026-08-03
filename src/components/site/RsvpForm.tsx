"use client";

/**
 * Event RSVP form.
 *
 * Client-side because it posts and shows a result without a page change. The
 * "already booked" case is treated as success, not an error — a parent who taps
 * twice should be reassured, not told off.
 */
import { useState } from "react";

type State = { status: "idle" | "sending" | "done"; message: string } | { status: "error"; message: string };

export function RsvpForm({ slug, full }: { slug: string; full: boolean }) {
  const [state, setState] = useState<State>({ status: "idle", message: "" });

  if (full) {
    return (
      <div className="edb-reg-closed">
        <strong>This event is full</strong>
        <p>
          Every place has been taken. Get in touch and we&apos;ll tell you about the
          next one.
        </p>
      </div>
    );
  }

  if (state.status === "done") {
    return (
      <div className="event-reg-success">
        <div className="event-reg-success-icon">🎉</div>
        <p>{state.message}</p>
        <p className="event-reg-email-note">
          We&apos;ve got your details — we&apos;ll email you a reminder before the day.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState({ status: "sending", message: "" });

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? "") || undefined,
          guests: Number(form.get("guests") ?? 1),
          website: String(form.get("website") ?? ""),
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        alreadyBooked?: boolean;
        error?: { message?: string };
      };

      if (!res.ok) {
        setState({
          status: "error",
          message: data.error?.message ?? "We couldn't book that. Please try again.",
        });
        return;
      }

      setState({
        status: "done",
        message: data.alreadyBooked
          ? "You're already on the list — no need to book again."
          : "You're booked in. See you there!",
      });
    } catch {
      setState({
        status: "error",
        message: "We couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  return (
    <form className="event-reg-form" onSubmit={onSubmit}>
      {state.status === "error" && (
        <p role="alert" style={{ color: "#E24B4A", fontSize: 13, margin: 0 }}>
          {state.message}
        </p>
      )}

      <label className="form-label" htmlFor="rsvp-name">
        Your name
      </label>
      <input className="form-input" id="rsvp-name" name="name" required minLength={2} maxLength={80} />

      <label className="form-label" htmlFor="rsvp-email">
        Email
      </label>
      <input
        className="form-input"
        id="rsvp-email"
        name="email"
        type="email"
        required
        maxLength={160}
      />

      <label className="form-label" htmlFor="rsvp-phone">
        Phone <span style={{ opacity: 0.6 }}>(optional)</span>
      </label>
      <input className="form-input" id="rsvp-phone" name="phone" maxLength={40} />

      <label className="form-label" htmlFor="rsvp-guests">
        How many of you?
      </label>
      <input
        className="form-input"
        id="rsvp-guests"
        name="guests"
        type="number"
        min={1}
        max={20}
        defaultValue={1}
      />

      {/* Honeypot — hidden from people, filled in by naive bots. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />

      <button className="btn-primary" type="submit" disabled={state.status === "sending"}>
        {state.status === "sending" ? "Booking…" : "Reserve my place →"}
      </button>
    </form>
  );
}
