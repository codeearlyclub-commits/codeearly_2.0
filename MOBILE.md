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
| Android | Android Studio + SDK, JDK 17+ (both present on the dev machine) |
| iOS | A Mac — **or** the `iOS build` GitHub Action, which rents one |

### Building iOS without a Mac

`.github/workflows/ios.yml` runs on a `macos-latest` runner, so no Apple
hardware is needed. It triggers on `v*` tags or manually — **not** on every
push, because GitHub bills macOS minutes at 10× the Linux rate on private repos
and an iOS build would quietly become the most expensive thing in the repo.

It degrades sensibly by design: with no signing secrets it does an **unsigned
build**, which still proves the project compiles. That means it is useful before
an Apple Developer account exists, rather than failing on signing and telling
you nothing.

To produce an installable build, add these repository secrets:

| Secret | What |
|---|---|
| `IOS_P12_BASE64` | Distribution certificate, base64 |
| `IOS_P12_PASSWORD` | Its password |
| `IOS_PROVISIONING_PROFILE_BASE64` | Provisioning profile, base64 |
| `APPSTORE_API_KEY_ID` / `_ISSUER_ID` / `_BASE64` | App Store Connect API key, for TestFlight |

Unavoidable regardless of hardware: the **Apple Developer Program, $99/year**.

> Capacitor 8 uses **Swift Package Manager**, not CocoaPods. There is no
> `Podfile` and no `.xcworkspace` — `xcodebuild` targets `App.xcodeproj`
> directly, and fetches plugin packages itself.

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
