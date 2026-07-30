# Audit — what is actually left before migration

_Written after being told, correctly, that the backend is not finished and a
migration would be premature. This counts the real surface rather than
summarising progress._

---

## 1. The headline

| | V4 (live) | 2.0 | Coverage |
|---|---|---|---|
| API routes | **171** | 20 | **~12%** |
| Admin sections | **36** | 5 | **14%** |
| Portal pages | **19** | 5 | **26%** |
| Public pages | **16** | 4 | **25%** |

2.0 has the *hard* parts — auth, money, tenancy, the quiz engine, deployment —
built and tested. What it does not have is most of the **product surface** those
foundations exist to serve.

**Migrating now would move live data onto a platform that cannot yet display
most of it.** There is nowhere for a report card, a certificate, a lesson, a
blog post or a showcase project to go.

## 2. What is genuinely done and verified

- Parent accounts, child profiles, student code+PIN sign-in, restricted sessions
- Payments: Paystack init/verify/webhook, gapless invoices, receipts, **fulfilment**
- Member subscriptions and organisation quiz plans with snapshotted entitlements
- Courses and programs: CRUD, catalogue, enrolment, overselling protection
- Quiz: authoring, engine, host console, player screens, results
- Admin: dashboard, courses, programs, quizzes, members, invoices
- Website: home, courses, programs (+ detail pages), about, contact — on the real
  ported V4 design
- Infrastructure: Docker verified end to end, email via Resend, 14 CI checks,
  48 unit tests, Android + iOS shells

## 3. What is missing — grouped by whether it needs new database models

### 3a. Needs new models (the real backend work)

Nothing in this list exists in `schema.prisma` today. Each needs models,
services, admin CRUD, and portal/public surfaces.

| Domain | Why it matters |
|---|---|
| **LMS: lessons, modules, content, progress** | The largest gap. A course is currently a title and a price with nothing inside it. Children cannot actually learn anything |
| **Report cards** | A core CodeEarly deliverable — parents expect them per term |
| **Certificates** | Issued on completion; referenced by membership IDs already printed |
| **Student tasks / assignments** | Homework between live classes |
| **Challenges + submissions** | The coding challenge with entries and judging |
| **Showcase** | Student projects, the strongest marketing asset you have |
| **Blog / magazine** | Content marketing, and a live V4 section |
| **Events + RSVP** | Meetups, competitions, open days |
| **Newsletter + subscribers** | With unsubscribe handling |
| **Messages / form submissions** | Contact enquiries are currently emailed and then lost — nothing is stored |
| **Testimonials, FAQs, partners** | Currently hardcoded in the homepage |
| **Site content / CMS pages** | V4's `[...slug]` editable pages |
| **Member payment plans** | `QuizPlan` covers the quiz product only; member plans are hardcoded |
| **Notifications** | In-app notification bell |
| **Device tokens** | Required before push can work at all |

### 3b. Needs no new models — wiring only

| Item | State |
|---|---|
| **R2 uploads** | Credentials unset, no upload service. Blocks course images, certificates, showcase |
| **Reminder jobs** | Queue runs; processor is a `TODO` stub — no subscription-expiry or session reminders actually send |
| **Quiz result PDFs** | Queue runs; processor is a `TODO` stub |
| **Nightly backups** | Queue runs; processor is a `TODO` stub |
| **FCM/APNs push** | Queue and stub worker exist; no delivery, no token registration |
| **Password reset UI** | Better Auth supports it; no pages exist |
| **Email verification resend UI** | Same |
| **Admin: settings, admin users, maintenance mode** | Not built |
| **Admin: payments ledger view** | Invoices exist; the payment ledger has no screen |
| **Portal: select-child, quiz history, change password, help** | Not built |
| **`/privacy` and `/terms`** | **Linked from the footer and currently 404** |
| **Child portal view** | Placeholder — "lessons coming soon" |
| **Blog/showcase/events pages** | Linked from the ported navbar; not built |

## 4. Known debt

| # | Item | Severity |
|---|---|---|
| 1 | 7 npm advisories, all dev-only ESLint tooling | Low |
| 2 | Prisma 6 → 7 available; `package.json#prisma` config deprecated | Low |
| 3 | Docker image is 1.33GB — `output: "standalone"` would cut it substantially | Low |
| 4 | No e2e browser tests (Playwright) | Medium |
| 5 | Homepage copy is hardcoded, not admin-editable | Medium |
| 6 | Contact enquiries are emailed but never stored | Medium |

## 5. Revised order

Migration moves to **last**, and the LMS moves up — it is the reason the
platform exists.

1. **Phase 5A — LMS core.** Lessons, modules, content blocks, progress. Admin
   authoring, child-facing player, parent visibility. Unblocks the child portal.
2. **Phase 5B — Uploads (R2).** Blocks images, certificates and showcase.
3. **Phase 5C — Learner records.** Report cards, certificates, tasks. Needs 5A + 5B.
4. **Phase 5D — Content surfaces.** Blog, showcase, events, testimonials, FAQs,
   plus `/privacy` and `/terms` so the footer stops lying.
5. **Phase 5E — Job processors.** Reminders, PDFs, backups, push + device tokens.
6. **Phase 5F — Gaps.** Password reset UI, admin settings/users, payment ledger
   view, portal odds and ends.
7. **Phase 6 — Migration and cut-over.** Once there is somewhere for every V4
   record to land.

## 6. What I need from you

| Need | Blocks |
|---|---|
| **R2 credentials** | Phase 5B, and everything after it |
| **VPS provider + region** | Any deployment; the mobile app is inert without a hosted URL |
| Defender exclusions | Build speed — installs still take hours |
| A sample report card + certificate | Getting 5C right first time rather than guessing |
| Mongo read-only URI | Phase 6 only. Not needed yet |
