-- Gapless invoice numbering.
--
-- A Postgres sequence is the obvious choice and the wrong one: nextval() does
-- not roll back, so a failed invoice insert burns a number and leaves a hole in
-- the series. Accounting wants an unbroken run, so the counter is an ordinary
-- row locked FOR UPDATE inside the same transaction as the invoice — the
-- increment lives or dies with it.

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- A counter that ran backwards would reissue an invoice number.
ALTER TABLE "Counter" ADD CONSTRAINT "counter_value_non_negative"
  CHECK ("value" >= 0);
