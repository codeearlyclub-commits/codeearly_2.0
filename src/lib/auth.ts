import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, admin } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

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
export const auth = betterAuth({
  appName: "CodeEarly",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
  },

  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "parent", input: false },
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
