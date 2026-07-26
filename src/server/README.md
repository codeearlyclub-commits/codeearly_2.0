# `src/server` — domain services

**The rule V4 lacked: business logic lives here, not inside route handlers.**

A service in this folder is framework-agnostic. It does not know about
`NextRequest`, cookies, or bearer tokens — it takes plain arguments, talks to
Prisma/Redis, and either returns a value or throws an `AppError`.

That buys three things V4 could not have:

1. **The same rule runs everywhere.** A route, a BullMQ job, and a migration
   script all call `enrollChild()`, so enrolment cannot mean three subtly
   different things depending on how it was triggered.
2. **Web and mobile share it.** The Capacitor app authenticates with a bearer
   token instead of a cookie, but hits the same endpoints calling the same
   services. Transport differs; logic does not.
3. **It is testable.** No HTTP mocking to check that an expired plan blocks a
   500-player room.

## Layout

| Folder | Owns |
|---|---|
| `orgs/` | Organizations, membership/roles, plan entitlements |
| `quiz/` | Competitions, sessions, join codes, scoring, results |
| `members/` | Parent + child accounts, membership IDs |
| `programs/` | Programs, sessions, program-only course locks |
| `payments/` | Paystack init/verify, webhook handling, the payment ledger |
| `invoices/` | Invoice generation, numbering, pay links |
| `email/` | Template rendering + enqueuing (never sends inline) |

## Conventions

- **Never trust a caller for tenancy.** Every function that touches quiz data
  takes an explicit `organizationId` and filters on it. There is no "current
  org" global to forget.
- **Throw `AppError`, never a string.** See `src/lib/errors.ts`.
- **Money is integer kobo.** See `src/lib/money.ts`.
- **No `try { } catch { return [] }`.** Swallowing errors is what made V4's bugs
  invisible. If you cannot handle it, let it propagate.
