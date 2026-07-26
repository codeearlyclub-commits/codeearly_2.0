import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * ESLint flat config. `npm run lint` had no config file at all before this, so
 * it failed rather than linting anything.
 */
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Unused vars are a real signal in a codebase this young — but allow the
      // conventional underscore escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // We are rebuilding precisely because V4 leaned on `any` and silent
      // failures. Warn now, tighten to error once the port is complete.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
