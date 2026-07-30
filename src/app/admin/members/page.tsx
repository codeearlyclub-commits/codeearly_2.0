/**
 * Admin members — the whole household per row.
 *
 * Search is a plain GET form with no client JavaScript. It is a search box; the
 * URL being shareable and the back button working are worth more here than
 * instant filtering, and support staff paste these links to each other.
 */
import Link from "next/link";

import { listFamilies, familyCounts } from "@/server/members/admin";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminMembersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const [families, counts] = await Promise.all([listFamilies({ q }), familyCounts()]);

  return (
    <>
      <header className="admin__head">
        <h1>Members</h1>
        <p className="muted">
          Parents hold the accounts; children are profiles beneath them. Search
          by parent email or name, a child&apos;s name, or a membership ID from a
          certificate.
        </p>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat__value">{counts.parents}</span>
          <span className="stat__label">Parents</span>
        </div>
        <div className="stat">
          <span className="stat__value">{counts.children}</span>
          <span className="stat__label">Children</span>
        </div>
        <div className="stat">
          <span className="stat__value">{counts.withStudentLogin}</span>
          <span className="stat__label">With student sign-in</span>
        </div>
        <div className="stat">
          <span className="stat__value">{counts.unverified}</span>
          <span className="stat__label">Unverified email</span>
        </div>
      </div>

      <form className="admin__search" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Email, name, or CE-2026-XXXX"
          aria-label="Search members"
        />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
        {q && (
          <Link href="/admin/members" className="muted">
            Clear
          </Link>
        )}
      </form>

      <div className="panel">
        {families.length === 0 ? (
          <p className="muted">
            {q ? `Nothing matches "${q}".` : "No members yet."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Parent</th>
                <th>Children</th>
                <th>Membership</th>
                <th>Owed</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <tr key={family.id}>
                  <td>
                    <b>{family.name}</b>
                    <br />
                    <span className="muted">{family.email}</span>
                    {family.phone && <><br /><span className="muted">{family.phone}</span></>}
                    {!family.emailVerified && (
                      <span className="pill pill--draft">unverified</span>
                    )}
                  </td>
                  <td>
                    {family.children.length === 0 ? (
                      <span className="muted">none yet</span>
                    ) : (
                      <ul className="child-mini">
                        {family.children.map((child) => (
                          <li key={child.id}>
                            <b>{child.name}</b>{" "}
                            <code className="muted">{child.membershipId}</code>
                            <br />
                            <span className="muted">
                              {child.courses} course{child.courses === 1 ? "" : "s"} ·{" "}
                              {child.programs} program{child.programs === 1 ? "" : "s"}
                              {child.studentLogin && " · has sign-in"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    {family.memberships.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      family.memberships.map((m, i) => (
                        <div key={i}>
                          <span className="pill pill--published">{m.plan}</span>
                          <br />
                          <span className="muted">
                            until {m.until.toLocaleDateString("en-NG")}
                          </span>
                        </div>
                      ))
                    )}
                  </td>
                  <td>
                    {family.owedKobo > 0 ? (
                      <b className="owed">{formatNaira(family.owedKobo)}</b>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{family.createdAt.toLocaleDateString("en-NG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
