import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — the native shell around the CodeEarly portal.
 *
 * WHY server.url RATHER THAN A BUNDLED BUILD
 *
 * The portal is server-rendered: sessions, live quiz state and payment
 * callbacks all need a server. A static export cannot do any of that, so the
 * shell loads the hosted portal instead of bundling HTML.
 *
 * The trade-off is deliberate. It means:
 *  - one codebase and one deploy; the app updates when the site does, with no
 *    store review for a copy change
 *  - the app requires connectivity, which for a live-class product it does anyway
 *  - native capability still works, because plugins (push, app lifecycle) run
 *    in the native layer regardless of where the web content came from
 *
 * CE_APP_URL must be HTTPS in a shipped build. Android blocks cleartext by
 * default and we do not relax that — the app carries children's session tokens.
 */
const url = process.env.CE_APP_URL ?? "https://www.codeearly.com";

const config: CapacitorConfig = {
  appId: "com.codeearly.club",
  appName: "CodeEarly Club",
  // Required by the CLI even when unused: with server.url set, the shell loads
  // the remote portal and never reads this directory.
  webDir: "public",

  server: {
    url,
    // Cleartext stays off. During local testing against a LAN address, run the
    // dev server behind HTTPS rather than turning this on.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    // Children hand devices to each other; a lost frame is better than a
    // screenshot of someone else's session surviving in the task switcher.
    allowMixedContent: false,
  },

  plugins: {
    PushNotifications: {
      // Class and quiz reminders arrive through the `push` BullMQ queue.
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
