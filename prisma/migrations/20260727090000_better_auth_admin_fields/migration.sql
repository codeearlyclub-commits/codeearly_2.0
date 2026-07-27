-- Columns Better Auth's admin() plugin writes but the initial schema lacked.
-- Their absence made every sign-up fail at the INSERT with "Unknown argument
-- `banned`" — caught by running the flow, not by typechecking.

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "impersonatedBy" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "banExpires" TIMESTAMP(3),
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "role" SET DEFAULT 'user';

-- Existing rows predate the plugin's vocabulary ("parent" -> "user").
UPDATE "user" SET "role" = 'user' WHERE "role" = 'parent';
