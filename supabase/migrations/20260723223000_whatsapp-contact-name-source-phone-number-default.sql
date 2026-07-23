-- `PHONE_NUMBER` is introduced by 20260723190331. This separate migration
-- runs after that enum change has committed, which is required by PostgreSQL
-- before a new enum value can be used as a column default.
alter table public.team_whatsapp_contacts
  alter column "nameSource" set default 'PHONE_NUMBER';
