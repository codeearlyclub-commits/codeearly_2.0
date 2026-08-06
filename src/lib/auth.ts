import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, admin } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendEmail, verificationEmail, passwordResetEmail } from "@/server/email/send";

/**
 * Better Auth — self-hosted, data in our own Postgres via Prisma.
 *
 * - email/password for parents (email verification on).
 * - bearer() plugin → token auth for the Capacitor mobile app (same endpoints
 *   the web uses with cookies).
 * - admin() plugin → role-based admin access.
 * - additionalFields → parent profile (parentName captured as `name`, phone).
 *
 * Sessions are cookie-based on web; Redis-backed secondary storage keeps
 * lookups fast and makes revocation instant.
 */
/**
 * Origins allowed to POST to the auth endpoints.
 *
 * Better Auth refuses a state-changing request whose Origin is not trusted —
 * its CSRF defence, and the reason a sign-in from `admin.codeearly.com` would
 * otherwise come back 403 while the identical request from `www` succeeded.
 * (That exact failure cost an hour when the isolation check used 127.0.0.1
 * against a baseURL of localhost.)
 *
 * So the admin host is added when ADMIN_HOST is configured — and only then, so
 * a single-host deployment trusts exactly one origin.
 */
function trustedOrigins(): string[] {
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const adminHost = process.env.ADMIN_HOST?.trim();
  if (!adminHost) return [base];

  try {
    const url = new URL(base);
    // Same scheme and port as the main site — only the hostname differs.
    url.hostname = adminHost;
    return [base, url.origin];
  } catch {
    return [base];
  }
}

export const auth = betterAuth({
  appName: "CodeEarly",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: trustedOrigins(),

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  /**
   * Redis as secondary storage. Sessions and rate-limit counters live here
   * instead of hitting Postgres on every authenticated request, and revocation
   * becomes a DELETE that every app container sees immediately — the property
   * a JWT cannot give us, and the reason ARCHITECTURE §6 lists Redis sessions.
   */
  secondaryStorage: {
    get: async (key) => redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
    },
  },

  /**
   * Rate limiting on the auth endpoints themselves, shared across containers
   * via Redis. Better Auth applies this to sign-in, sign-up, reset and verify —
   * the endpoints where an unauthenticated stranger can guess at credentials.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: "secondary-storage",
    customRules: {
      // Credential guessing is the attack that matters; keep these tight.
      "/sign-in/email": { window: 15 * 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/forget-password": { window: 60 * 60, max: 3 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...passwordResetEmail(user.name, url) });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Queued, never sent inline — a slow provider must not become a slow
      // signup, and a failed send must retry rather than vanish.
      await sendEmail({ to: user.email, ...verificationEmail(user.name, url) });
    },
  },

  user: {
    additionalFields: {
      // `role` is deliberately NOT declared here — the admin() plugin owns it
      // ("user" | "admin"). Declaring it too made our default fight the
      // plugin's, and the plugin wins at insert time.
      phone: { type: "string", required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh daily
  },

  plugins: [
    bearer(), // mobile token auth
    admin(),  // admin role gating
  ],
});

export type Session = typeof auth.$Infer.Session;
