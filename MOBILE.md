# CodeEarly Mobile (Capacitor)

The app is a native shell around the hosted portal — **not** a second codebase.
Every screen it shows is the same Next.js portal the browser gets, which is why
the API has accepted bearer tokens since Phase 1.

## What is native, and what is not

| Native | Web |
|---|---|
| Push notifications (FCM / APNs) | Every screen |
| App lifecycle, deep links | Auth, payments, quizzes |
| Store presence, home-screen icon | All business logic |

## Why it loads a URL instead of bundling the site

The portal is server-rendered: sessions, live quiz state and Paystack callbacks
all need a server. A static export cannot do those things. So
`capacitor.config.ts` sets `server.url`, and the shell loads the hosted portal.

The consequences are worth stating plainly:

- **One deploy.** The app updates when the website does — no store review to fix
  a typo or change a price.
- **It needs connectivity.** Acceptable for a product built around live classes,
  but it is a real constraint, not a detail.
- **Native plugins still work.** They run in the native layer regardless of where
  the web content came from, so push and lifecycle are unaffected.

## Prerequisites

| Target | Needs |
|---|---|
| Android | Android Studio + SDK, JDK 17+ |
| iOS | **macOS** with Xcode — cannot be built on Windows |

## First-time setup

```bash
npx cap add android          # creates android/ (committed)
npx cap sync android         # copy config + plugins into the native project
npx cap open android         # opens Android Studio to build/run
```

Point the shell at a running server:

```bash
# Production (default)
CE_APP_URL=https://www.codeearly.com npx cap sync android

# Local testing — HTTPS, because cleartext is deliberately disabled
CE_APP_URL=https://192.168.1.20:3000 npx cap sync android
```

> `cleartext` stays **off**. Android blocks plaintext HTTP by default and we do
> not relax it: the app carries session tokens belonging to children.

## Push notifications

1. Create a Firebase project, add an Android app with id `com.codeearly.club`.
2. Download `google-services.json` into `android/app/`.
3. The device registers its token with the portal; the `push` BullMQ queue
   (`src/jobs/worker.ts`) delivers to FCM.

The queue and job type already exist. The FCM call itself is the remaining
piece, marked `TODO(mobile)` in the worker.

## Store submission

- **Android:** Play Console, `com.codeearly.club`. Needs a privacy policy URL
  (`/privacy`) and a Data Safety declaration — the app handles children's data,
  so Play's Families policy applies.
- **iOS:** App Store Connect, same bundle id. Apple's Kids Category rules apply
  and are stricter: no third-party analytics or advertising without verifiable
  parental consent.

Both stores treat "app is a wrapper around a website" as grounds for rejection
if the app adds nothing native. Push notifications and the offline/launch
experience are the substantive additions here — worth making obvious in the
review notes.
