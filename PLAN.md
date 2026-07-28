# CodeEarly 2.0 — Plan

_Replaces the roadmap sketch in ARCHITECTURE.md §11. That was written before any
code existed; this is written from the actual state of the repository._

---

## 1. Where we actually are

Ten commits in. The honest summary is that **the load-bearing layers are done
and tested, and most of the visible product is not built yet.** That imbalance
was deliberate — auth, money and tenancy are the things that are ruinous to
retrofit — but it is now the thing to correct.

| Surface | Built | Notes |
|---|---|---|
| Public website | **~0%** | Landing stub only. The data layer behind it exists |
| Parent portal | **~25%** | Auth, children, student codes. No invoices/courses/programs UI |
| Admin | **0%** | Nothing. This is why no real content exists yet |
| Mobile app | **0% shell** | No Capacitor project — but every endpoint already takes bearer tokens |
| Quiz product | **~15%** | Tenancy, plans, entitlements, billing, join codes. No engine, no host UI |

**Backend:** roughly Phase 3 of 6. **Visible product:** roughly Phase 1.

## 2. What is verified, not merely written

Everything below is asserted by an automated check, most of them in CI:

| Check | Guards against |
|---|---|
| `check-invoice-numbering` | A rolled-back transaction leaving a hole in the invoice series |
| `check-program-capacity` | Overselling a program under concurrent registration |
| `check-paystack-webhook` (9) | Forged signatures, double-credit on retry, amount mismatch |
| `check-paystack-api` (6) | Initialize/verify against the real Paystack test API (local only — CI has no keys) |
| `tests/unit` (29) | Money conversion; plan entitlements, lapse and suspension |
| Manual E2E (12) | Signup → verify → child → student login; child/parent isolation; PIN lockout |

**Four real defects were found by running things, not reading them:** every
signup was broken by missing auth columns; sessions claimed Redis they were not
using; there was no auth rate limiting at all; and programs could be oversold.
Three would have reached production silently.

## 3. Known debt

| # | Item | Severity | Plan |
|---|---|---|---|
| 1 | ~~Email cannot send~~ **RESOLVED.** Resend is primary (REST via `fetch`, no SDK), SMTP is fallback. Key valid, `codeearly.com` already verified, real test message delivered. The broken `mail.codeearly.com` SMTP host no longer matters — it is an unused fallback | Resolved | — |
| 2 | ~~Docker never built or run~~ **RESOLVED.** Full stack verified: Caddy → Next.js → Postgres + Redis, `/api/health` returns `db: ok, redis: ok` over HTTPS, migrations applied on container start. Found and fixed a deployment-breaking bug in doing so: compose builds the *last* Dockerfile stage without an explicit `target`, so the `app` service was running the **worker** image and crash-looping on a missing production build | Resolved | Image is 1.33GB — switch to `output: "standalone"` when convenient |
| 3 | 7 npm advisories, all dev-only ESLint tooling | Low | No production exposure; revisit when upstream fixes land |
| 4 | Prisma 6 → 7 available; `package.json#prisma` config deprecated | Low | Do as its own change, not mid-phase |
| 5 | `next build` fetches fonts from Google at build time | Low | Self-host woff2 if it keeps failing on flaky DNS |
| 6 | No e2e browser tests | Medium | Playwright once the portal has real screens |
| 7 | ARCHITECTURE.md §11 roadmap is now stale | — | Superseded by this document |

## 4. The replan

The original roadmap put **the entire saleable quiz product in Phase 4, ahead of
migrating the live platform**. Now that the cost of a phase is measurable, that
ordering puts a second product between you and cut-over. So Phase 4 is split,
and admin moves earlier.

### Phase 3A — Admin core _(next)_
Courses, programs, sessions, content CRUD. Grouped nav + ⌘K palette.
**Why first:** it unblocks *you*. Until it exists, every course and program has
to come from me writing fixtures. With it, you create real content while I build
the surfaces that render it.
Also: wire SMTP so email verification actually reaches a parent.

### Phase 3B — Public website
Home, about, courses, programs, events, showcase, blog, membership, contact.
Ported content from V4, rebuilt on the token layer. SEO, sitemap, structured data.
**Why second:** it is the top of the funnel, and it needs real content to render.

### Phase 3C — Portal depth + LMS
Lessons, tasks, progress, report cards, certificates, invoices UI, enrolment
flows. The child-facing side of the student login already built.

### Phase 3D — Mobile shell
Capacitor wrap of the portal, native push via the `push` queue. Small, because
the API has been bearer-ready since Phase 1.

### Phase 4 — Quiz engine _(CodeEarly's own)_
Socket.io + Redis, server-authoritative state machine, the full lifecycle and
every fix earned in V4. Multi-tenant from the first line, but only CodeEarly
hosts on it. **This is what Friday quizzes need, and it is worth having before
cut-over.**

### Phase 5 — Migration & cut-over
V4 Mongo → Postgres, verification, DNS switch. **Moved ahead of the public quiz
product**, so the live platform lands on solid ground instead of waiting behind
a second product.

### Phase 6 — Public quiz product _(the saleable layer)_
Org signup, host dashboard, join-code rooms with guest players, plan checkout,
public directory, trust & safety. Everything structural for this already exists
in the schema, so it is additive rather than a rewrite.

**The change in one line:** ship CodeEarly's own platform first, then sell the
quiz engine — rather than building a second product before the first is
migrated.

## 5. Blocked on you

| Need | For | Status |
|---|---|---|
| Defender exclusions (admin PowerShell) | Everything — builds take minutes | Outstanding |
| SMTP credentials | Real email verification | Available in V4 `.env` |
| Brand assets (logo, any designs) | 3B website polish | Palette + fonts recovered from V4 |
| R2 credentials | Uploads, certificates | Needed by 3C |
| Mongo read-only URI | Phase 5 migration | Available in V4 `.env` |
| VPS provider + region | Deployment | Undecided — Hetzner (cheap, EU) vs closer to Nigeria |
| Timeline / target date | Sequencing | Undecided |

## 6. Risks

1. **This machine.** A 2-hour npm install, 10-minute lint runs, intermittent DNS
   and Docker port failures. Not a code risk, but it is the single largest drag
   on delivery, and the Defender exclusions are a two-minute fix.
2. **Cut-over timing.** Every phase before Phase 5 is time the live V4 platform
   keeps running with its known ceilings — the Pusher 100-connection cap during
   Friday quizzes being the sharpest.
3. **Scope of the quiz product.** It is a genuine second product with its own
   support burden, abuse surface, and duty of care to other people's children.
   Worth confirming the appetite before Phase 6 rather than during it.
