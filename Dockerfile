# ── Base ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ── Deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
# Generous fetch timeouts and retries: npm's defaults give up on a slow or
# flaky link, and `npm ci` here has failed twice with EIDLETIMEOUT after
# 20 minutes of real downloading. Retrying the whole image build to recover
# from one stalled socket is far more expensive than waiting longer per request.
RUN npm config set fetch-timeout 900000 \
 && npm config set fetch-retries 6 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 180000 \
 && npm ci --no-audit --no-fund

# ── Builder: prisma client + next build ──────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runner (app): full deps so `prisma migrate deploy` + `next start` both work.
# (Standalone image is a later optimization; correctness first for Phase 0.)
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "run", "start"]

# ── Worker: full deps + source, runs BullMQ via tsx ──────────────────────────
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
CMD ["node_modules/.bin/tsx", "src/jobs/worker.ts"]
