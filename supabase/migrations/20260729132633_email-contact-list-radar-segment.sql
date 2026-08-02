-- D6: vincula EmailContactList a um TeamRadarSegment (1:1, opcional).
-- Import/adição manual de contatos passa a "montar" um segmento, sem forçar
-- todo import a ter um.
alter table "public"."corretor_studio_email_contact_lists"
  add column if not exists "radarSegmentId" uuid;

create index if not exists "corretor_studio_email_contact_lists_radarSegmentId_idx"
  on "public"."corretor_studio_email_contact_lists" using btree ("radarSegmentId");

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'corretor_studio_email_contact_lists_radarSegmentId_fkey'
  ) then
    alter table "public"."corretor_studio_email_contact_lists"
      add constraint "corretor_studio_email_contact_lists_radarSegmentId_fkey"
      foreign key ("radarSegmentId")
      references "public"."corretor_studio_radar_segments" ("id")
      on delete set null
      on update cascade;
  end if;
end $$;
