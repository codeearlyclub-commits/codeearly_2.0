# `tests/`

| Folder | What |
|---|---|
| `unit/` | Domain logic from `src/server/*` and pure helpers in `src/lib/*`. No HTTP, no browser. |
| `e2e/` | A small number of Playwright journeys that must never break: sign up → verify → add child → pay → appears in portal, and host a quiz → guest joins by code → results published. |

**Test runner is not installed yet.** `vitest` (unit) and `@playwright/test`
(e2e) get added in the same dependency pass as `@eslint/eslintrc` — deliberately
batched, because dependency installs on this connection are slow.

What to cover first, in priority order:

1. `src/lib/money.ts` — kobo/naira conversion. Money bugs are unrecoverable.
2. `src/server/orgs/entitlements.ts` — plan limits, expiry fallback, SYSTEM
   exemption, suspension. This is what stands between a free account and a
   500-player room.
3. `src/lib/ids.ts` — join-code and membership-ID format and randomness.
4. Quiz state machine transitions once Phase 4 starts (`LOBBY → ACTIVE →
   REVEALED → ENDED`), including the reconnect-mid-question case.
