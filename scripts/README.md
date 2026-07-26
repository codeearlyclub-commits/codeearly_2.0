# `scripts/`

One-off and operational scripts. They import the same services from
`src/server/*` that the app uses — a script must never reimplement a business
rule, or it will drift from the app and corrupt data quietly.

Planned:

| Script | Phase | Purpose |
|---|---|---|
| `migrate-from-v4.ts` | 6 | MongoDB → Postgres. Reads V4 collections, maps to Prisma models, inserts in FK-safe order (parents → children → enrolments → invoices → quiz data). Idempotent, resumable, and verifies counts before it reports success. |
| `verify-migration.ts` | 6 | Counts and money totals per collection vs V4. Refuses to pass on any mismatch. |
| `backup.ts` | 1 | `pg_dump` to R2 with retention. Also runnable from the `backup` BullMQ queue. |
| `restore.ts` | 1 | Restore a dump into a target database. Rehearsed before cut-over, not after. |
| `create-admin.ts` | 1 | Bootstrap the first admin user on a fresh install. |

Run with `npx tsx scripts/<name>.ts`.
