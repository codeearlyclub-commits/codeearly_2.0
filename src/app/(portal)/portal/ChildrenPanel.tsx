"use client";

/**
 * Child list + management.
 *
 * The one piece of genuinely delicate UX here is the student login: the code
 * and PIN are shown exactly once and can never be retrieved again. So they get
 * a deliberately prominent, dismissable panel rather than a toast that could
 * disappear before a parent has written them down.
 */
import { useState } from "react";

type Child = {
  id: string;
  name: string;
  membershipId: string;
  studentLoginEnabled: boolean;
};

type IssuedLogin = { childId: string; loginCode: string; pin: string; emailedTo: string };

export function ChildrenPanel({ initialChildren }: { initialChildren: Child[] }) {
  const [children, setChildren] = useState(initialChildren);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLogin | null>(null);

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
    return body;
  }

  async function addChild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("add");
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const body = await call("/api/portal/children", {
        method: "POST",
        body: JSON.stringify({
          childName: String(data.get("childName") ?? "").trim(),
          dateOfBirth: data.get("dateOfBirth") || undefined,
        }),
      });
      setChildren((prev) => [
        ...prev,
        { ...body.child, studentLoginEnabled: false },
      ]);
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function issueLogin(childId: string) {
    setError(null);
    setBusy(childId);
    try {
      const body = await call(`/api/portal/children/${childId}/student-login`, {
        method: "POST",
      });
      setIssued({ childId, ...body });
      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, studentLoginEnabled: true } : c))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function disableLogin(childId: string) {
    setError(null);
    setBusy(childId);
    try {
      await call(`/api/portal/children/${childId}/student-login`, { method: "DELETE" });
      setChildren((prev) =>
        prev.map((c) => (c.id === childId ? { ...c, studentLoginEnabled: false } : c))
      );
      if (issued?.childId === childId) setIssued(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2>Your children</h2>

      {error && <p role="alert" className="error">{error}</p>}

      {issued && (
        <div className="notice" role="status">
          <h3>Sign-in details — write these down now</h3>
          <p>
            Code <b style={{ letterSpacing: "0.2em" }}>{issued.loginCode}</b> · PIN{" "}
            <b style={{ letterSpacing: "0.2em" }}>{issued.pin}</b>
          </p>
          <p className="muted">
            We can&apos;t show these again. A copy has been emailed to{" "}
            {issued.emailedTo}. Your child signs in at <b>/student</b>.
          </p>
          <button type="button" onClick={() => setIssued(null)}>
            I&apos;ve saved them
          </button>
        </div>
      )}

      {children.length === 0 ? (
        <p className="muted">No children yet. Add your first below.</p>
      ) : (
        <ul className="child-list">
          {children.map((child) => (
            <li key={child.id}>
              <div>
                <b>{child.name}</b>
                <span className="muted"> · {child.membershipId}</span>
              </div>
              <div>
                {child.studentLoginEnabled ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === child.id}
                      onClick={() => issueLogin(child.id)}
                    >
                      New code &amp; PIN
                    </button>
                    <button
                      type="button"
                      disabled={busy === child.id}
                      onClick={() => disableLogin(child.id)}
                    >
                      Turn off sign-in
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy === child.id}
                    onClick={() => issueLogin(child.id)}
                  >
                    Give {child.name} their own sign-in
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Add a child</h3>
      <form onSubmit={addChild}>
        <label>
          Child&apos;s name
          <input name="childName" type="text" required minLength={2} maxLength={80} />
        </label>
        <label>
          Date of birth <span className="muted">(optional)</span>
          <input name="dateOfBirth" type="date" />
        </label>
        <button type="submit" disabled={busy === "add"}>
          {busy === "add" ? "Adding…" : "Add child"}
        </button>
      </form>
    </section>
  );
}
