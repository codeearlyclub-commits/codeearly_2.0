"use client";

/**
 * Child management — add a child, issue or revoke their sign-in.
 *
 * The one piece of genuinely delicate UX here is the student login: the code
 * and PIN are shown exactly once and can never be retrieved again. So they get
 * a deliberately prominent, dismissable panel rather than a toast that could
 * disappear before a parent has written them down — and the dismiss button says
 * "I've saved them", not "OK", because the parent should have to assert it.
 *
 * The add-child form is collapsed by default once a parent has children. It is
 * a once-a-year action sitting under a screen they open weekly, so leaving it
 * permanently open makes the page look like a form rather than a dashboard.
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
  const [adding, setAdding] = useState(initialChildren.length === 0);

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
      setChildren((prev) => [...prev, { ...body.child, studentLoginEnabled: false }]);
      form.reset();
      setAdding(false);
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

  async function disableLogin(child: Child) {
    if (
      !confirm(
        `Turn off ${child.name}'s sign-in? Their code and PIN stop working immediately. Their progress is kept, and you can issue new details later.`
      )
    ) {
      return;
    }

    setError(null);
    setBusy(child.id);
    try {
      await call(`/api/portal/children/${child.id}/student-login`, { method: "DELETE" });
      setChildren((prev) =>
        prev.map((c) => (c.id === child.id ? { ...c, studentLoginEnabled: false } : c))
      );
      if (issued?.childId === child.id) setIssued(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="portal-section">
      <div className="portal-section__head">
        <h2>Sign-in details</h2>
        {!adding && (
          <button type="button" className="pbtn" onClick={() => setAdding(true)}>
            + Add a child
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="pnotice pnotice--warn" style={{ marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {issued && (
        <div className="pnotice pnotice--good" role="status">
          <h3>Write these down now</h3>
          <div className="credentials">
            <div>
              <span>Code</span>
              <b>{issued.loginCode}</b>
            </div>
            <div>
              <span>PIN</span>
              <b>{issued.pin}</b>
            </div>
          </div>
          <p>
            We can&apos;t show these again — a copy has been emailed to{" "}
            <b>{issued.emailedTo}</b>. Your child signs in at <b>/student</b>.
          </p>
          <button type="button" className="pbtn pbtn--primary" onClick={() => setIssued(null)}>
            I&apos;ve saved them
          </button>
        </div>
      )}

      {children.length > 0 && (
        <div>
          {children.map((child) => (
            <div className="prow" key={child.id}>
              <div className="prow__main">
                <div className="prow__title">{child.name}</div>
                <div className="prow__sub">
                  {child.membershipId} ·{" "}
                  {child.studentLoginEnabled
                    ? "can sign in on their own"
                    : "no sign-in yet"}
                </div>
              </div>
              <div className="prow__end">
                {child.studentLoginEnabled ? (
                  <>
                    <button
                      type="button"
                      className="pbtn"
                      disabled={busy === child.id}
                      onClick={() => issueLogin(child.id)}
                    >
                      New code &amp; PIN
                    </button>
                    <button
                      type="button"
                      className="pbtn pbtn--danger"
                      disabled={busy === child.id}
                      onClick={() => disableLogin(child)}
                    >
                      Turn off
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="pbtn pbtn--primary"
                    disabled={busy === child.id}
                    onClick={() => issueLogin(child.id)}
                  >
                    {busy === child.id ? "Creating…" : `Give ${child.name} a sign-in`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="pcard" style={{ marginTop: children.length > 0 ? "1rem" : 0 }}>
          <h3
            style={{
              fontFamily: "var(--font-nunito), sans-serif",
              fontWeight: 800,
              color: "var(--navy)",
              marginBottom: "0.75rem",
            }}
          >
            Add a child
          </h3>
          <form className="pform" onSubmit={addChild}>
            <div className="pform__row">
              <label>
                Child&apos;s name
                <input name="childName" type="text" required minLength={2} maxLength={80} />
              </label>
              <label>
                Date of birth <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
                <input name="dateOfBirth" type="date" />
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="submit" className="pbtn pbtn--primary" disabled={busy === "add"}>
                {busy === "add" ? "Adding…" : "Add child"}
              </button>
              {children.length > 0 && (
                <button type="button" className="pbtn pbtn--ghost" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
