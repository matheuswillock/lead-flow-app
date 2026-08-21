-- Causal IDs legados são derivados somente de chaves técnicas já persistidas.
-- O namespace é fixo para que reexecuções produzam o mesmo UUID v5.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'uuid-ossp') then
    create extension if not exists "uuid-ossp" with schema extensions;
  end if;
end $$;

update "public"."corretor_studio_public_form_metric_events"
set
  "schemaVersion" = coalesce("schemaVersion", 1),
  "occurredAt" = coalesce("occurredAt", "createdAt"),
  "eventId" = coalesce(
    "eventId",
    extensions.uuid_generate_v5(
      '6f3d9002-e3b0-4a76-9a38-ecfb3a595fbb'::uuid,
      concat('public-form-metric:', "eventKey")
    )
  )
where "schemaVersion" is null or "occurredAt" is null or "eventId" is null;

update "public"."corretor_studio_public_form_submissions"
set
  "eventId" = coalesce(
    "eventId",
    extensions.uuid_generate_v5(
      '6f3d9002-e3b0-4a76-9a38-ecfb3a595fbb'::uuid,
      concat('public-form-submission:', "requestKey")
    )
  ),
  "nextDispatchAt" = coalesce("nextDispatchAt", "createdAt")
where "eventId" is null or "nextDispatchAt" is null;

update "public"."corretor_studio_public_form_answers" answer
set
  "sourceEventId" = coalesce(answer."sourceEventId", submission."eventId"),
  "answeredAt" = coalesce(answer."answeredAt", answer."createdAt")
from "public"."corretor_studio_public_form_submissions" submission
where submission."id" = answer."submissionId"
  and (answer."sourceEventId" is null or answer."answeredAt" is null);

update "public"."corretor_studio_public_form_queue_event_failures"
set
  "schemaVersion" = coalesce("schemaVersion", 1),
  "eventId" = coalesce(
    "eventId",
    extensions.uuid_generate_v5(
      '6f3d9002-e3b0-4a76-9a38-ecfb3a595fbb'::uuid,
      concat('public-form-outbox:', "idempotencyKey")
    )
  ),
  "payload" = case
    when "payload" ? 'schemaVersion' then "payload"
    else jsonb_build_object('schemaVersion', 1, 'legacyPayload', "payload")
  end
where "schemaVersion" is null or "eventId" is null or not ("payload" ? 'schemaVersion');
