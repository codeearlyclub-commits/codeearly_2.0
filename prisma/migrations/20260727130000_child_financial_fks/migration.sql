-- Invoice.childId and Subscription.childId were plain strings with nothing
-- guaranteeing they pointed at a real child. Nothing stopped a typo, and
-- deleting a child left dangling references that no query would ever resolve —
-- the exact class of orphan the move off MongoDB was meant to eliminate.

-- Clear any references that do not resolve, so the constraint can be created.
UPDATE "Invoice" SET "childId" = NULL
WHERE "childId" IS NOT NULL
  AND "childId" NOT IN (SELECT "id" FROM "Child");

UPDATE "Subscription" SET "childId" = NULL
WHERE "childId" IS NOT NULL
  AND "childId" NOT IN (SELECT "id" FROM "Child");

-- SET NULL rather than CASCADE on both: a paid invoice and a subscription are
-- financial records that must survive a child's profile being deleted. They
-- lose the link, never the row. Deleting accounting history to tidy up a
-- profile would be worse than the orphan we are fixing.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
