-- Link a PT session's payment to the session.
--
-- Without it, marking a session unpaid again left its payment in the books,
-- and marking it paid once more recorded a second one. Older rows stay
-- unlinked: there is no reliable way to tell which session they paid for.
ALTER TABLE "Payment" ADD COLUMN "ptSessionId" TEXT;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_ptSessionId_fkey"
  FOREIGN KEY ("ptSessionId") REFERENCES "PtSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_ptSessionId_idx" ON "Payment"("ptSessionId");

-- At most one open invoice per subscription.
--
-- The sweep checks for an open invoice before issuing one, but two instances
-- running the sweep, or a subscribe landing during it, both pass the check and
-- bill the same term twice. Partial, so paid and void history is unaffected;
-- Prisma's schema language cannot express that, which is why it lives here.
--
-- Any duplicates already issued are voided first, keeping the earliest: it is
-- the one the owner was mailed about first.
UPDATE "SubscriptionInvoice" i
SET "status" = 'void'
FROM "SubscriptionInvoice" earlier
WHERE i."status" = 'open'
  AND earlier."status" = 'open'
  AND earlier."subscriptionId" = i."subscriptionId"
  AND (earlier."issuedAt" < i."issuedAt"
       OR (earlier."issuedAt" = i."issuedAt" AND earlier."id" < i."id"));

CREATE UNIQUE INDEX "SubscriptionInvoice_one_open_per_subscription"
  ON "SubscriptionInvoice"("subscriptionId")
  WHERE "status" = 'open';
