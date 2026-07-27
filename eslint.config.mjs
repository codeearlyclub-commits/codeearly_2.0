import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * ESLint flat config.
 *
 * eslint-config-next v16 ships native flat config, so this composes its arrays
 * directly. The previous FlatCompat/@eslint/eslintrc bridge crashed against it
 * ("Converting circular structure to JSON") and is no longer needed — which
 * also drops the eslintrc dependency chain that several advisories sat in.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "next-env.d.ts",
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    // Pinned rather than auto-detected: eslint-plugin-react's version sniffing
    // calls an ESLint 9 API that ESLint 10 removed, and crashes the whole run.
    // Naming the version skips that code path entirely.
    settings: { react: { version: "19.2" } },
  },

  {
    rules: {
      // Unused vars are a real signal in a codebase this young, with the
      // conventional underscore escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // We are rebuilding precisely because V4 leaned on `any` and silent
      // failures. Warn now; tighten to error once the port is complete.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default config;
