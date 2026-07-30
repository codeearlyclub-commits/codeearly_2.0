"use client";

/**
 * Join form.
 *
 * The guest token is kept in sessionStorage, not localStorage: it is a
 * credential for one quiz on one device, and a shared classroom tablet must not
 * hand the next child the previous child's seat when the tab is reopened.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinQuiz() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const data = new FormData(e.currentTarget);
    const joinCode = String(data.get("joinCode") ?? "").trim();
    const displayName = String(data.get("displayName") ?? "").trim();

    // Reuse a token for THIS code if we already have one, so a refresh mid-quiz
    // returns the child to their own seat and score.
    const stored = sessionStorage.getItem(`ce-quiz-${joinCode}`);
    const guestToken = stored ? JSON.parse(stored).guestToken : undefined;

    const res = await fetch("/api/quiz/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode, displayName, guestToken }),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      setBusy(false);
      setError(body?.error?.message ?? "We couldn't join that quiz.");
      return;
    }

    sessionStorage.setItem(
      `ce-quiz-${joinCode}`,
      JSON.stringify({
        sessionId: body.sessionId,
        participantId: body.participantId,
        guestToken: body.guestToken,
        displayName: body.displayName,
      })
    );

    router.push(`/play/${body.sessionId}?code=${encodeURIComponent(joinCode)}`);
  }

  return (
    <form onSubmit={onSubmit} className="play__form">
      <label>
        Room code
        <input
          name="joinCode"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          minLength={6}
          required
          autoComplete="off"
          placeholder="123456"
          className="play__code"
          autoFocus
        />
      </label>

      <label>
        Your name
        <input
          name="displayName"
          type="text"
          maxLength={40}
          required
          autoComplete="off"
          placeholder="Ada"
        />
      </label>

      {error && <p role="alert" className="error">{error}</p>}

      <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
        {busy ? "Joining…" : "Let's play"}
      </button>
    </form>
  );
}
