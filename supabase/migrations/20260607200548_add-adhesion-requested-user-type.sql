-- Persist the Member PRO toggle chosen at adhesion creation time so it can be
-- applied to the master profile once the account is actually created (mirrors
-- how extraTeams/extraUsers are stored at creation and consumed later in
-- ensureAccountForPaidAdhesion/createPaidManagerProfile).
alter table "public"."backoffice_adhesions"
  add column if not exists "requestedUserTypeSlug" text,
  add column if not exists "requestedMemberProAccessExpiresAt" timestamptz(6);
