-- Explicit operator-approved grace may preserve CRM access after Member PRO expires.
ALTER TABLE "billing_access_graces"
  ADD COLUMN "allowExpiredMemberProCrm" BOOLEAN NOT NULL DEFAULT false;
