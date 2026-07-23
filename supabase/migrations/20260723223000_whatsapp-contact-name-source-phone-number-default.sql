-- `PHONE_NUMBER` is introduced by 20260723190331. This separate migration
-- runs after that enum change has committed, which is required by PostgreSQL
-- before a new enum value can be used as a column default. The initial
-- nullable column lets us classify legacy contacts without overwriting a
-- genuine PUSH_NAME assigned after the migration has run.
update public.team_whatsapp_contacts
set "nameSource" = 'PHONE_NUMBER'
where "nameSource" is null;

alter table public.team_whatsapp_contacts
  alter column "nameSource" set default 'PHONE_NUMBER',
  alter column "nameSource" set not null;
