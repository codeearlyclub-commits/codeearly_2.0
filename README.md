# CodeEarly 2.0

Rebuild of the CodeEarly platform with proper architecture.
**Next.js (App Router) · PostgreSQL + Prisma · Redis · BullMQ · Better Auth · Docker · Caddy.**

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full plan, rationale, and roadmap.

---

## Prerequisites
- Docker Desktop (with Compose)
- Node.js 20+ (for local dev outside Docker)

## First-time setup

```bash
# 1. Environment
cp .env.example .env
#   then edit .env — at minimum set POSTGRES_PASSWORD, DATABASE_URL password,
#   and BETTER_AUTH_SECRET (generate:  openssl rand -base64 32)

# 2. Install deps (for local dev + to create the first migration)
npm install

# 3. Start Postgres + Redis only, so we can create the initial DB migration
docker compose up -d postgres redis

# 4. Create the initial migration from prisma/schema.prisma
#    (uses DATABASE_URL from .env; point host to localhost for this step)
npx prisma migrate dev --name init

# 5. Bring up the whole stack
docker compose up -d --build
```

Open **http://localhost** (Caddy) or **http://localhost:3000** (app direct).
The landing page shows live Postgres + Redis status. Health JSON: `/api/health`.

> **Note on step 4:** run it with `DATABASE_URL` pointing at `localhost:5432`
> (Postgres is published to the host). The app container uses the in-network
> `postgres:5432` host automatically (set in docker-compose). Once the migration
> exists in `prisma/migrations/`, the app container applies it with
> `prisma migrate deploy` on every start.

## Everyday commands

```bash
npm run dev            # Next.js dev server (needs postgres+redis up)
npm run worker:dev     # BullMQ worker with reload (needs redis up)
npm run prisma:studio  # visual DB browser
npm run prisma:migrate # create a new migration after editing schema.prisma
npm run typecheck      # tsc --noEmit
docker compose logs -f app worker   # tail services
docker compose down    # stop (add -v to wipe DB/redis volumes)
```

## Services (docker compose)

| Service | What | Port |
|---|---|---|
| `caddy` | Reverse proxy + automatic HTTPS | 80/443 |
| `app` | Next.js web + API | 3000 (internal) |
| `worker` | BullMQ job processor | — |
| `postgres` | PostgreSQL 16 | 5432 |
| `redis` | Redis 7 (cache, queues, sessions) | 6379 |

## Layout

```
prisma/schema.prisma   data model (source of truth)
src/lib/               env, prisma, redis, auth (Better Auth)
src/app/               routes: landing, /api/health, /api/auth/*
src/jobs/              BullMQ queues + worker entrypoint
src/server/            (Phase 1+) domain services — logic lives here, not in routes
```

## Production
Set real values in `.env` (incl. `SITE_DOMAIN=www.codeearly.com`, live Paystack
keys, R2 creds), point DNS at the server, open ports 80/443, then
`docker compose up -d --build`. Caddy fetches the TLS cert automatically.

## Roadmap
Phase 0 (this) → 1 Auth/members → 2 Payments → 3 Courses/programs →
4 Quiz engine → 5 Admin → 6 Migrate V4 data & cut over. Details in ARCHITECTURE.md.
