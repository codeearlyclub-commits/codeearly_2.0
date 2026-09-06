# Audit — what exists, what is left, what could go wrong

_Rewritten 2026-09-05 by counting the repository rather than summarising
progress. Every number below came from enumerating files, models and routes in
both codebases; V4 at `codeearly-website` is the requirements baseline because
it is the product that is actually live._

**The previous version of this file was materially wrong.** It claimed 20 API
routes, 5 admin sections, and that the LMS did not exist in `schema.prisma`. The
real figures are 44, 14, and the LMS core is built and covered by a CI check.
Planning was being done against numbers a phase out of date. Corrections are
listed in §7.

---

## 1. The headline

| | V4 (live) | 2.0 | Coverage |
|---|---|---|---|
| API routes | **175** | 44 | **25%** |
| Pages (all) | **120** | 54 | **45%** |
| — admin | ~71 | 19 | **27%** |
| — portal (parent) | 27 | 6 | **22%** |
| — public | 21 | 16 | **76%** |
| Data models | 14 Mongo collections | **41 Prisma models** | — |

The shape of the gap has changed since the last audit. The public website is
nearly complete, the LMS core landed, and admin went from nothing to fourteen
sections. **What is now furthest behind is the parent portal and the long tail
of admin tooling** — not the LMS.

---

## 2. Built and verified

Verified means an automated check asserts it, not that it was written.

**Foundations**

- Postgres + Prisma: 41 models, 10 migrations, real FKs, cascade deletes, enums
- Better Auth: parent accounts, roles, bearer-ready for mobile
- Child access: student code + 4-digit PIN, 12-hour Redis session, separate
  token namespace, 5-attempt lockout, regeneration kills live sessions
- Session isolation: parent and child sessions evict each other; verified
- Admin on its own origin (`ADMIN_HOST`), 16 assertions
- Redis: sessions, rate limits, BullMQ, Socket.io adapter
- Docker: Caddy → app + worker + realtime → Postgres + Redis, verified end to end
- CI: migrations, idempotent seed, 7 domain checks, 74 unit tests, typecheck,
  lint, build, webhook contract

**Domain**

- Payments: Paystack init/verify/webhook, gapless invoices, receipts, fulfilment
- Subscriptions and org quiz plans with entitlements snapshotted at purchase
- Courses and programs: CRUD, catalogue, enrolment, oversell protection
- **LMS core**: sections, lessons, lesson blocks, ordering, progress, resume
  position, completion, streaks, activity log, XP — `check-lms.ts` in CI
- Report cards and certificates: models, admin screens, public verify by serial
- Quiz: authoring, engine, host console, player screens, results, join codes
- Content: blog, showcase, events + RSVP, testimonials, FAQs, newsletter,
  contact messages (stored, not just emailed)

**Surfaces**

- Public: home, about, courses (+detail), programs (+detail), blog (+post),
  events (+detail), showcase, FAQ, contact, privacy, terms, unsubscribe
- Portal: home, courses, programs, records, invoices, account
- Child: `/me`, course player, lesson player
- Admin: dashboard, courses, programs, blog, events, faqs, invoices, members,
  messages, records, showcase, subscribers, testimonials, competitions + host
- Mobile: Capacitor config, `android/` and `ios/` shells present

---

## 3. What is left

### 3a. Needs new models

None of these exist in `schema.prisma`.

| Domain | V4 surface | Why it matters |
|---|---|---|
| **Student tasks / assignments** | `/admin/student-tasks`, `/member/tasks`, submissions, feedback, bulk | Homework between live classes. A core weekly touchpoint |
| **Challenges + submissions** | `/admin/challenges`, `/member/challenges`, `/challenge/submit` | The public coding challenge, with entries and judging |
| **LMS assignments + quizzes** | `/admin/lms/assignments/*`, `/lessons/[id]/quiz`, grading | Lessons can be authored but not assessed |
| **Notifications** | `/admin/notifications`, `/member/notifications`, broadcast | In-app bell; also the fallback when email fails |
| **Device tokens** | — (V4 had no push) | **Push cannot work at all without this** |
| **Member payment plans** | `/admin/payment-plans`, `/admin/subscription-plans` | Member pricing is hardcoded. `QuizPlan` covers the quiz product only |
| **Site pages / CMS** | `/admin/content/*`, `/admin/pages`, `/(public)/[...slug]` | Homepage copy needs a deploy to change |
| **Partners** | homepage section | Currently hardcoded |

### 3b. Wiring only — models already exist

| Item | State |
|---|---|
| **R2 uploads** | `env.ts` names the vars; **no upload service exists**. Blocks course images, certificates, showcase, avatars |
| **Reminder jobs** | Nothing enqueues them and nothing schedules them. The `subscription-expiry` branch is written and works; session and birthday reminders are `TODO` |
| **Quiz result PDFs** | Queue runs, processor is `TODO(Phase 4)` |
| **Nightly backups** | Queue runs, processor is `TODO(Phase 6)`. **Nothing is backed up** |
| **Push delivery** | Queue and stub exist; no FCM/APNs, no token registration |
| **Password reset UI** | `sendResetPassword` and `sendVerificationEmail` ARE wired in `lib/auth.ts`. Only the pages are missing, so this is smaller than it looks — but a locked-out parent still has no path |
| **Email verification resend UI** | Same |
| **Portal depth** | 21 of V4's 27 parent pages absent: select-child, quiz history, change password, settings, help, add-child, subscribe, tasks, certificates, challenges, competitions |
| **Admin long tail** | settings, admin users, maintenance, payments ledger, api-docs, help, kahoot, newsletter compose/send, message templates and campaigns, LMS import |
| **Child navigation** | `(learn)/layout.tsx` renders bare children — no header, no nav, sign-out buried at the bottom of `/me` |

### 3c. Data migration

`scripts/migrate-from-v4.ts` **does not exist.** It is referenced in
`scripts/README.md` and ARCHITECTURE §10 as though it does. 175 V4 routes worth
of data shapes must be mapped in FK-safe order.

---

## 4. Risks

Ranked by what they would actually cost.

### Severe

**1. There are no backups.** The `backup` processor is a `TODO`. This platform
holds payment records, invoices and children's learning history. A lost Postgres
volume loses all of it with no recovery path. This is the highest-consequence
item in the repository and it is a stub.

**2. Four of the five queues have no producer, and nothing recurs.** Counting
`.add()` calls: `emailQueue` 1, and `reminders`, `quiz`, `backup`, `push` zero
between them. There is no repeatable job, scheduler or cron anywhere. So the
backup has TWO independent reasons never to run — a stub processor, and nothing
that would call it.

The stubs compound it: they `return` normally, so BullMQ marks those jobs
**completed**, the `failed` handler never fires, and a queue dashboard shows
green. A stub is worse than a crash — a crash retries and lands in the failed
set where you would see it.

Note `subscription-expiry` IS fully implemented and does real enforcement work.
It is dead code only because nothing triggers it, so one scheduler registration
brings it to life.

**3. No password reset.** On a live platform with paying parents this is a
support crisis in week one, and it is the most common auth request there is.

**4. No end-to-end tests.** 74 unit tests and 12 domain checks are genuinely
good, but nothing drives a browser. Every regression found so far in the actual
flows — the child redirect loop, the connection-pool exhaustion, the 404 storm —
was found by a human clicking, not by CI.

### High

**5. Migration is underestimated.** The script is unwritten, the mapping is
unspecified, and V4's surface is four times ours. This is the phase most likely
to slip, and it is scheduled last, when pressure is highest.

**6. R2 blocks a whole column of work.** Certificates, showcase, course images
and avatars all wait on credentials outstanding across three planning documents.

**7. iOS cannot ship from this machine.** The `ios/` shell exists but Apple
requires macOS to build and sign. There is no Mac in the picture and no plan
for one.

**8. Single VPS, no failover, provider undecided.** One box runs Postgres,
Redis, the app, the worker and the realtime server. The deployment target is
still an open question in ARCHITECTURE §13, which also blocks the mobile app — a
Capacitor shell with no hosted URL is inert.

**9. This machine is a delivery risk in its own right.** One CPU, hours-long
installs, and a disk that reached zero bytes and corrupted the Turbopack cache,
producing a day of phantom 404s across 97 of 98 routes. Defender exclusions have
been outstanding since the first plan.

### Medium

**10. Content is hardcoded.** V4 had a CMS with nine editable sections plus
`[...slug]` pages. Changing homepage copy in 2.0 requires a code change and a
deploy — a regression against the live product.

**11. Member pricing is hardcoded.** Changing a price is a deploy.

**12. The quiz product carries duty-of-care obligations.** It deliberately puts
strangers near children. The schema has the controls; the moderation surfaces —
abuse reports, suspensions, host verification — are not built. It should not
ship before they are.

**13. Children's data compliance.** Privacy and terms pages exist, but there is
no data-retention policy, no deletion-request path, and no recorded parental
consent beyond account creation.

**14. Housekeeping.** Prisma 6→7 pending, 7 dev-only npm advisories, and a
1.33GB Docker image that `output: "standalone"` would cut substantially.

---

## 5. Revised order

> **Superseded by [PLAN.md](./PLAN.md)**, rewritten after the queue producers
> were counted. Kept for its reasoning.

The LMS core is done, so the old ordering is spent. What follows is sequenced by
risk retired per unit of work.

1. **5A — Make the invisible visible.** Backup processor, reminder processor,
   failure alerting. Small, and it retires the two severe infrastructure risks.
   *Nothing else should go first.*
2. **5B — Auth completeness.** Password reset, verification resend, change
   password. Live-blocking on day one.
3. **5C — Uploads (R2).** Unblocks certificates, showcase, course images.
4. **5D — Portal depth + child navigation.** Now the largest surface gap.
5. **5E — Tasks, assignments, challenges.** The weekly touchpoints. Needs models.
6. **5F — CMS + pricing.** Stop requiring a deploy to change copy or a price.
7. **5G — Admin long tail.** Settings, users, maintenance, ledger, campaigns.
8. **5H — E2E tests (Playwright).** Before migration, not after.
9. **6 — Migration and cut-over.** Write the script, verify counts, switch DNS.
10. **7 — Public quiz product.** Only after trust and safety surfaces exist.

---

## 6. Blocked on you

| Need | Blocks | Age |
|---|---|---|
| **R2 credentials** | 5C and everything downstream | 3 planning docs |
| **VPS provider + region** | Any deployment; mobile inert without it | 3 planning docs |
| **Defender exclusions** | Build speed on this machine | 3 planning docs |
| **A Mac, or a plan for one** | iOS release entirely | New |
| Sample report card + certificate | Getting 5C right first time | 2 docs |
| Mongo read-only URI | Phase 6 only | Not yet needed |

---

## 7. Corrections to the previous audit

| Claim | Reality |
|---|---|
| 20 API routes (~12%) | **44 (25%)** |
| 5 admin sections (14%) | **14 sections, 19 pages (27%)** |
| "LMS: nothing exists in `schema.prisma` today" | **Built** — 6 models, 4 service modules, player UI, CI check |
| "`/privacy` and `/terms` currently 404" | **Both exist** |
| "Blog/showcase/events not built" | **All three built**, public and admin |
| "Report cards, certificates missing" | **Models, admin screens and public verify built** |
| "Contact enquiries emailed then lost" | **`ContactMessage` model + admin screen** |

The lesson is not that the estimate was pessimistic — it is that the audit was
not re-derived from the repository before being used to plan.
