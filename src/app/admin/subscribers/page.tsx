/**
 * Newsletter subscribers.
 *
 * People who unsubscribed are shown, greyed out, rather than hidden. The row is
 * never deleted — that is what makes it impossible for a later import to
 * resurrect someone who asked us to stop.
 */
import { listSubscribers } from "@/server/content/content";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminSubscribersPage() {
  const subscribers = await listSubscribers();
  const active = subscribers.filter((s) => s.unsubscribedAt === null);

  return (
    <>
      <header className="admin__head">
        <h1>Newsletter</h1>
        <p className="muted">
          Unsubscribes are kept as records, not deleted — so nobody can be
          accidentally re-added later.
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__value">{active.length}</div>
          <div className="stat__label">Subscribed</div>
        </div>
        <div className="stat">
          <div className="stat__value">{subscribers.length - active.length}</div>
          <div className="stat__label">Unsubscribed</div>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nobody has signed up yet.
                </td>
              </tr>
            )}
            {subscribers.map((sub) => (
              <tr key={sub.id} style={sub.unsubscribedAt ? { opacity: 0.5 } : undefined}>
                <td>{sub.email}</td>
                <td>{sub.name ?? "—"}</td>
                <td>{dateFmt.format(sub.createdAt)}</td>
                <td>
                  {sub.unsubscribedAt ? (
                    <span className="pill pill--archived">
                      left {dateFmt.format(sub.unsubscribedAt)}
                    </span>
                  ) : (
                    <span className="pill pill--published">subscribed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
