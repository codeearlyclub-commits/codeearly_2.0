# CodeEarly 2.0 — Architecture Plan

_Status: draft for approval · Author: rebuild of the V4 platform with proper architecture_

## 1. Decisions (locked)

| Area | Choice |
|---|---|
| Hosting | **VPS + Docker Compose** (single server: app + Postgres + Redis + reverse proxy) |
| Database | **PostgreSQL + Prisma** (typed ORM, migrations, foreign keys, transactions) |
| Cache / queue / realtime bus | **Redis** (sessions, rate limits, cache, BullMQ jobs, Socket.io adapter) |
| App | **Next.js (App Router) full-stack**, one Dockerized app + one worker process |
| Build approach | **Clean rebuild**, reuse V4's UI/CSS + domain logic, migrate live data |

## 2. Why this shape — the three V4 constraints it removes

V4 (Next.js on Vercel + Atlas M0 + Pusher) hit three ceilings. A persistent VPS with Postgres + Redis removes all three at once:

1. **DB connection cap (Atlas 500 / serverless pools):** a long-lived container holds one stable Postgres pool. No per-lambda pool explosion. No 500-connection ceiling.
2. **Pusher 100-connection free cap (Friday quizzes):** self-hosted **Socket.io + Redis adapter** — unlimited concurrent kids, no per-message pricing, on hardware you already pay for.
3. **Email 100/day + cron limits:** **BullMQ on Redis** runs a real job queue and scheduler — throttled email sending, reminders, retries — no Vercel cron ceiling, no silent drops.

Plus it fixes the structural debt: Prisma replaces the hand-rolled Mongo store and the `tryDb` error-swallowing that hid the bugs we chased (blank admin content, wrong showcase counts, orphaned records). Foreign keys + cascade deletes become the database's job, not hand-written cleanup.

## 3. Stack

- **Framework:** Next.js (App Router), TypeScript, React — `output: "standalone"` for a small Docker image.
- **DB:** PostgreSQL 16, **Prisma** ORM (schema + migrations + typed client).
- **Cache/queue/pubsub:** Redis 7.
- **Realtime:** Socket.io (Node server) with `@socket.io/redis-adapter` so multiple app instances share rooms.
- **Jobs:** BullMQ (Redis-backed) in a **separate worker container** — emails, reminders, quiz result finalization, backups.
- **Auth:** **Better Auth** — self-hosted, data in our own Postgres via the Prisma adapter. Cookie sessions for web **and** bearer tokens for the mobile app; built-in plugins for email verification, 2FA, rate limiting, and admin roles. (Chosen over rolling our own — auth is not where we want hand-written risk, especially with mobile tokens in the mix.)
- **Payments:** Paystack (reuse V4's verified integration + webhook pattern).
- **Email:** Resend primary + SMTP (Brevo) fallback, sent **through the BullMQ queue** (rate-limited, retried).
- **Storage/uploads:** **Cloudflare R2** (10 GB free, **zero egress**, S3-compatible — pairs with the Cloudflare we front with). MinIO in Compose is the fully-owned fallback. **Large video is never stored as blobs** — showcase videos go to YouTube-unlisted / Cloudflare Stream, we store only the link; R2 handles images, PDFs, certificates, avatars.
- **Reverse proxy + TLS:** **Caddy** (automatic HTTPS/Let's Encrypt, tiny config) in front of the app.
- **Observability:** structured logging (pino), Sentry for errors, Uptime Kuma (self-host) for uptime.

## 4. Repository structure (monorepo-lite, single Next.js app)

```
codeearly-2.0/
├─ docker-compose.yml           # app, worker, postgres, redis, caddy
├─ Dockerfile                   # multi-stage build (app + worker share image)
├─ Caddyfile                    # reverse proxy + auto TLS
├─ .env.example                 # every required var, documented
├─ prisma/
│  ├─ schema.prisma             # single source of truth for the data model
│  └─ migrations/               # versioned, reviewable SQL
├─ src/
│  ├─ app/                      # Next.js routes (public, portal, admin, api)
│  ├─ server/                   # domain logic (framework-agnostic services)
│  │  ├─ payments/  quiz/  members/  programs/  invoices/  email/
│  ├─ lib/                      # db (prisma client), redis, auth, rate-limit, env
│  ├─ realtime/                 # socket.io server + event contracts
│  ├─ jobs/                     # BullMQ queues + worker entrypoint
│  ├─ components/  styles/      # UI (ported from V4)
├─ scripts/                     # migrate-from-v4, seed, backup, restore, check-*
└─ tests/                       # domain unit tests + a few e2e (Playwright)
```

Key rule we lacked in V4: **business logic lives in `src/server/*` services, not inside route handlers** — so it's testable and reused by routes, jobs, and scripts alike.

## 5. Data model (Prisma — relational core)

Real foreign keys + cascade deletes replace V4's 14-collection manual cleanup. Sketch:

```prisma
model Parent {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  parentName    String
  phone         String?
  emailVerified DateTime?
  children      Child[]
  subscriptions Subscription[]
  invoices      Invoice[]
  createdAt     DateTime @default(now())
}

model Child {
  id           String  @id @default(cuid())
  parentId     String
  parent       Parent  @relation(fields: [parentId], references: [id], onDelete: Cascade)
  membershipId String  @unique            // CE-YYYY-XXXX, random suffix
  childName    String
  dateOfBirth  DateTime?
  enrollments      Enrollment[]
  programEnrollments ProgramEnrollment[]
  quizParticipants  QuizParticipant[]
  @@index([parentId])
}

// Courses, Programs, Enrollments, Invoices, Payments, Subscriptions,
// Quiz{Competition,Question,Session,Participant,Answer,Result} — all with FKs.
// Money in integer kobo. Every payment row immutable + audited.
```

Enums for statuses (no more free-string `"null"` bugs). `Invoice.status`, `QuizSession.phase` (`lobby|active|revealed|ended`) become Postgres enums the DB enforces.

## 6. Redis usage (the payoff for having it)

| Use | How |
|---|---|
| Sessions | cookie → session id → Redis hash; instant logout/revoke; no JWT bloat |
| Rate limiting | shared sliding-window across all instances (V4's was per-instance memory) |
| Caching | published courses/programs/homepage — cache-aside with pub/sub invalidation on admin edit (no more stale ISR tradeoffs) |
| Realtime | Socket.io Redis adapter — quiz rooms shared across app instances |
| Jobs | BullMQ queues: `email`, `reminders`, `quiz`, `backup` |

## 7. Realtime quiz engine (rebuilt clean)

Server-authoritative state machine in Postgres (`QuizSession.phase` enum), broadcast over Socket.io. Carries forward every fix we earned in V4 — explicit lobby, admin-only start, synced countdown, first-question race fix, session-scoped results, motivational cheers — but on infra with **no connection cap**. The quiz session's authoritative timer lives server-side (Redis TTL) so all clients stay in sync even on reconnect.

## 7b. Mobile app (membership portal)

**Capacitor** wraps the same Next.js portal in a native iOS/Android shell → real
app-store apps + native push (class/quiz reminders) from one codebase. This
imposes one design rule that shapes everything: **the portal talks to a clean,
versioned API that accepts bearer-token auth**, so web (cookies) and mobile
(tokens) share the exact same endpoints. Better Auth's bearer plugin provides the
token flow; server logic in `src/server/*` is transport-agnostic so it serves
both without duplication. Push via a `push` BullMQ queue → FCM/APNs.

## 7c. Admin information architecture

V4's admin was ~35 flat nav items. 2.0 uses **grouped, collapsible sections plus
a ⌘K command palette**:

- **Overview** — Dashboard (incl. live DB storage + connections monitors)
- **People** — Members · Students · Subscribers
- **Learning** — Courses · Programs · Report Cards · Certificates · Tasks · Challenges
- **Live** — Quiz/Competitions · Events · Kahoot
- **Money** — Payments · Invoices · Plans · Subscriptions
- **Marketing** — Website Content · Blog · Showcase · Testimonials · FAQs · Newsletter · Messages
- **System** — Settings · Admin Users · Maintenance · API Docs

Command palette jumps anywhere by keystroke so grouping never costs speed.

## 8. Background jobs (BullMQ)

Replaces V4's single daily Vercel cron dispatcher:
- **email** — every transactional/marketing send, rate-limited to provider limits, auto-retry with backoff.
- **reminders** — subscription expiry, program sessions, birthdays (repeatable jobs).
- **quiz** — finalize results, generate PDFs off the request path.
- **backup** — nightly `pg_dump` to object storage + retention (real automated backups, the thing M0 never had).

## 9. Deployment

`docker compose up -d` brings up: **caddy** (TLS) → **app** (Next.js) + **worker** (BullMQ) → **postgres** + **redis** (named volumes for data). Deploy = `git pull && docker compose build && docker compose up -d` (or a GitHub Action → SSH). Zero-downtime via a second app container + Caddy load-balance later. Nightly `pg_dump` cron on the host as belt-and-braces.

**Provider:** Hetzner CPX21 (~€8/mo, 3 vCPU / 4GB) comfortably runs all of this for hundreds of concurrent users — cheaper than V4's Atlas+Pusher+Vercel upgrades combined, with no per-connection ceilings.

## 10. Migration from V4 (MongoDB → Postgres)

1. Freeze V4 writes (brief maintenance window) — or dual-run read-only.
2. `scripts/migrate-from-v4.ts`: read Mongo collections → map to Prisma models → insert in FK-safe order (parents → children → enrollments → invoices → quiz data). IDs preserved where possible.
3. Verify counts + spot-check money records against V4.
4. Cut DNS/Caddy over to the new server; keep V4 warm for 48h as rollback.

## 11. Phased roadmap

- **Phase 0 — Foundation:** Compose (postgres+redis+app+caddy), Prisma schema + first migration, env, CI, health checks. _App boots, DB connected._
- **Phase 1 — Auth & members:** parent/child accounts, sessions in Redis, email verify, rate limits.
- **Phase 2 — Payments & billing:** Paystack + webhook + BullMQ email; invoices incl. custom invoices with pay links.
- **Phase 3 — Courses & programs:** LMS, enrollments, program-only locks, public marketing pages (ported UI).
- **Phase 4 — Quiz engine:** Socket.io + Redis, full lifecycle, PDFs via worker.
- **Phase 5 — Admin:** dashboard, content editors (schema-validated), CSV exports, DB monitors.
- **Phase 6 — Migrate & cut over:** data migration, verification, DNS switch.

## 12. Decisions locked (round 2)

- **Uploads:** Cloudflare R2 (MinIO fallback); no raw video in blobs.
- **Mobile:** Capacitor wrapping the portal; API must support bearer tokens.
- **Auth:** Better Auth (self-hosted, Postgres, cookie + token, 2FA/verify/roles built in).
- **Admin IA:** grouped nav + ⌘K palette.

## 13. Open questions before Phase 0

1. **Timeline** — background build while V4 runs the Bootcamp (Aug 10)? _(Strongly recommend yes — no pressure on live revenue.)_
2. **VPS provider/region** — Hetzner (EU, cheapest) vs a closer-to-Nigeria region for latency. Cloudflare in front either way. Want a recommendation?
3. **Phase 0 kickoff** — scaffold the stack now (compose + Prisma + Dockerfile + Caddyfile + Better Auth wiring so `docker compose up` boots everything locally), or keep planning first?
