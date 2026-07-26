-- Student sign-in for children: a parent-issued code + PIN granting a
-- restricted session. No email and no password is ever stored for a minor.

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginCode" TEXT,
ADD COLUMN     "loginEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Child_loginCode_key" ON "Child"("loginCode");

-- ── CHECK constraints (hand-written; Prisma cannot express these) ────────────

-- An enabled login without a code or hash would be a child account that can
-- never be signed into, or worse, one whose PIN check is skipped.
ALTER TABLE "Child" ADD CONSTRAINT "child_login_requires_credentials"
  CHECK ("loginEnabled" = false OR ("loginCode" IS NOT NULL AND "pinHash" IS NOT NULL));

-- The code is typed by a child off a card: fixed length, unambiguous alphabet.
ALTER TABLE "Child" ADD CONSTRAINT "child_logincode_format"
  CHECK ("loginCode" IS NULL OR "loginCode" ~ '^[A-Z0-9]{6}$');
