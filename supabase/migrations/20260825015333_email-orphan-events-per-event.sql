drop index if exists "public"."email_orphan_events_resendEmailId_key";

alter table "public"."email_orphan_events" alter column "status" drop default;

alter type "public"."email_orphan_event_status" rename to "email_orphan_event_status__old_version_to_be_dropped";

create type "public"."email_orphan_event_status" as enum ('pending', 'processed', 'failed', 'skipped', 'processing');

alter table "public"."email_orphan_events" alter column status type "public"."email_orphan_event_status" using status::text::"public"."email_orphan_event_status";

alter table "public"."email_orphan_events" alter column "status" set default 'pending'::public.email_orphan_event_status;

drop type "public"."email_orphan_event_status__old_version_to_be_dropped";

CREATE INDEX IF NOT EXISTS "email_orphan_events_resendEmailId_idx" ON public.email_orphan_events USING btree ("resendEmailId");

CREATE UNIQUE INDEX IF NOT EXISTS "email_orphan_events_resendEmailId_resendEventType_occurredA_key" ON public.email_orphan_events USING btree ("resendEmailId", "resendEventType", "occurredAt");

CREATE INDEX IF NOT EXISTS "email_orphan_events_status_occurredAt_idx" ON public.email_orphan_events USING btree (status, "occurredAt");
