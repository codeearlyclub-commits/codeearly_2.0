# Plan

_Rewritten 2026-09-06. Supersedes the previous plan and the ordering in
[AUDIT.md](./AUDIT.md) §5. [AUDIT.md](./AUDIT.md) stays as the inventory — what
exists, counted — and this is what to do about it._

---

## 1. What changed the plan

Two things were found by running the system rather than reading it, and both
move work that was scheduled late to the front.

**The job queues have no producers.** Redis and BullMQ are working correctly, but
four of the five queues are never written to and nothing recurs:

```
emailQueue      1 producer call
reminderQueue   0
quizQueue       0
backupQueue     0
pushQueue       0

repeatable jobs / schedulers:  none anywhere
```

So the missing piece is not five processors — it is **a scheduler**. There are
two independent reasons nothing is backed up: the processor is a `TODO`, and
nothing would ever call it. Writing `pg_dump` today would change nothing.

Worse, the stub processors `return` normally, so BullMQ marks those jobs
**completed**. The `failed` handler never fires and a queue dashboard shows
green. A stub is worse than a crash: a crash retries and lands in the failed set
where you would see it.

One consolation: `subscription-expiry` is fully implemented — it expires ended
subscriptions and lapsed org plans. It is dead code purely because nothing
triggers it. One scheduler registration brings it to life.

**A browser sweep found what no test could.** 88 page loads across four
audiences at two widths. The public site was clean, but the child area had no
navigation at all, and the child's own name rendered navy-on-navy at 1.07:1 —
invisible. Both are now fixed; the point is that neither was findable by any
check that does not open a page and measure colour.

---

## 2. The ordering principle

**Risk retired per unit of work, not features per unit of work.** Everything in
Phase A is small. It is first because the platform currently cannot prove it
would survive a disk failure.

---

## 3. The plan

### Phase A — Make the queues real _(next, ~1 day)_

The whole phase is small and retires both severe risks in [AUDIT.md](./AUDIT.md) §4.

| # | Task | Why |
|---|---|---|
| A1 | **A scheduler.** Register repeatable jobs on worker boot via BullMQ's `JobScheduler` — nightly backup, a daily reminders sweep. Idempotent, so restarts do not duplicate | Nothing recurs today. This alone activates the already-written expiry enforcement |
| A2 | **Backup processor.** `pg_dump` → the `pgdata` volume's sibling, gzip, retention window. R2 upload lands in Phase C | **Do not block backups on R2 credentials.** A local dump on the same box is weak, and it is infinitely better than nothing |
| A3 | **Unimplemented processors must fail loudly.** `quiz` and `backup` throw a clear "not implemented" rather than returning success. `push` stays a logged no-op — there is no mobile client to receive one yet | A job that silently succeeds is indistinguishable from one that worked |
| A4 | **Failure alerting.** On a job exhausting retries, enqueue an ops email | Otherwise the failed set is a page nobody opens |

**Verification:** a `check-jobs.ts` that boots the worker, asserts the schedulers
are registered, enqueues one of each job, and asserts a dump file exists on disk
and that a stubbed queue actually fails. In CI.

### Phase B — Auth completeness _(~1 day)_

Smaller than previously scoped: `sendResetPassword` and `sendVerificationEmail`
are already wired in `lib/auth.ts`. **Only the pages are missing.**

- `/forgot-password`, `/reset-password`
- Resend verification
- Change password in the portal
- A link back to the site from the five sign-in pages — the sweep flags every
  one as having no way off it

**Why now:** a locked-out parent currently has no self-service path at all. On a
live platform with paying customers this is a week-one support crisis.

### Phase C — Uploads (R2) _(blocked on credentials)_

`env.ts` declares all five R2 vars as `.optional()`, so the app boots without
them and nothing complains. Add the upload service, then wire certificates,
showcase images, course art and avatars.

**Unblock locally with MinIO in compose** rather than waiting. The S3 API is the
same, so the swap to R2 is a config change.

### Phase D — Portal depth + child growth _(largest surface gap)_

6 of V4's 27 parent pages exist. In rough order of who asks for them: select
child, quiz history, change password, settings, help, add child, subscribe,
tasks, certificates, challenges, competitions.

The child header added this week grows into tabs here, once there is somewhere
to tab to.

### Phase E — Tasks, assignments, challenges _(needs models)_

`StudentTask`, `Assignment`, `Challenge`, `ChallengeSubmission`, `Notification`,
`DeviceToken`. The weekly touchpoints between live classes, and the thing that
makes the LMS more than a video list.

### Phase F — CMS + pricing

Homepage copy and member pricing are hardcoded; V4 had both editable. Changing a
price currently means a deploy. `SitePage`, `PaymentPlan`, `Partner`.

### Phase G — Admin long tail

Settings, admin users, maintenance mode, payments ledger, newsletter compose and
send, message templates and campaigns, LMS import.

Plus the small one the sweep found: **every admin page's `<title>` is the public
site's**, because no admin page exports `metadata`. Staff get a dozen identical
tabs.

### Phase H — End-to-end tests

Promote `scripts/ui-sweep.ts` from a survey to a gate and put it in CI, plus real
journeys: sign up → verify → add child → student sign-in → complete a lesson;
and a payment through the Paystack test rail.

**Before migration, not after.**

### Phase I — Migration and cut-over

Write `scripts/migrate-from-v4.ts` — it does not exist despite being referenced
in `scripts/README.md` and ARCHITECTURE §10 as though it does. Map 175 V4 routes
worth of shapes in FK-safe order, verify counts, switch DNS.

### Phase J — Public quiz product

Only after the trust and safety surfaces exist: abuse reports, suspensions, host
verification. It deliberately puts strangers near children.

---

## 4. Quick wins, not worth a phase

Do these alongside whatever is in flight.

| Item | Cost |
|---|---|
| **Retry on DB connect.** A transient blip currently becomes a 500 in a parent's face — the sweep caught one on `/portal`. Prisma has no retry; a short bounded retry on connect errors is a few lines | Minutes |
| Admin page titles (`export const metadata` per section) | Minutes |
| `output: "standalone"` — cuts the 1.33GB image substantially | Minutes |
| Prisma 6 → 7, and move `package.json#prisma` to `prisma.config.ts` | An hour, on its own |

---

## 5. Blocked on you

| Need | Blocks | Age |
|---|---|---|
| **R2 credentials** | Phase C and everything downstream | 3 planning docs |
| **VPS provider + region** | Any deployment; the mobile app is inert without a hosted URL | 3 planning docs |
| **Defender exclusions** | Build speed on this machine | 3 planning docs |
| **A Mac, or a plan for one** | iOS release entirely — `ios/` exists but Apple requires macOS to build and sign | New |
| Sample report card + certificate | Getting Phase C right first time rather than guessing | 2 docs |
| Mongo read-only URI | Phase I only | Not yet needed |

---

## 6. What this plan deliberately does not do

- **It does not start new product surface until Phase A is done.** One day of
  work is the difference between "we have backups" and "we believe we do".
- **It does not wait for R2 to start backing up.** A local dump now beats a
  perfect dump later.
- **It keeps the quiz product last.** It is a second product with its own support
  burden and duty of care, and the first one is not migrated yet.
