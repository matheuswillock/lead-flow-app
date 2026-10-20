-- Password reset audit contract.
-- Deliberately stores no token, password, token hash, raw action URL, or
-- provider payload.

create type "public"."password_reset_flow_status" as enum (
  'requested',
  'link_generated',
  'email_sent',
  'verification_pending',
  'token_verified',
  'completed',
  'expired',
  'invalidated',
  'failed'
);

create type "public"."password_reset_event_type" as enum (
  'requested',
  'link_generated',
  'email_sent',
  'email_failed',
  'email_delivered',
  'email_opened',
  'email_clicked',
  'page_opened',
  'verification_started',
  'token_verified',
  'token_rejected',
  'password_updated',
  'password_update_failed',
  'expired',
  'invalidated',
  'failed'
);

create table "public"."password_reset_flows" (
  "id" uuid not null,
  "profileId" uuid,
  "recipientEmail" text not null,
  "dispatchId" uuid,
  "resendEmailId" text,
  "status" "public"."password_reset_flow_status" not null default 'requested',
  "ipHash" text,
  "userAgent" text,
  "originScreen" text,
  "requestedAt" timestamptz(6) not null default CURRENT_TIMESTAMP,
  "linkGeneratedAt" timestamptz(6),
  "emailSentAt" timestamptz(6),
  "tokenVerifiedAt" timestamptz(6),
  "completedAt" timestamptz(6),
  "expiresAt" timestamptz(6),
  "failureCode" text,
  "createdAt" timestamptz(6) not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) not null,

  constraint "password_reset_flows_pkey" primary key ("id")
);

create table "public"."password_reset_events" (
  "id" uuid not null,
  "flowId" uuid not null,
  "type" "public"."password_reset_event_type" not null,
  "occurredAt" timestamptz(6) not null default CURRENT_TIMESTAMP,
  "requestId" text,
  "failureCode" text,
  "ipHash" text,
  "userAgent" text,
  "createdAt" timestamptz(6) not null default CURRENT_TIMESTAMP,

  constraint "password_reset_events_pkey" primary key ("id")
);

create index "password_reset_flows_profile_requested_idx"
  on "public"."password_reset_flows" ("profileId", "requestedAt" desc);
create index "password_reset_flows_recipient_requested_idx"
  on "public"."password_reset_flows" ("recipientEmail", "requestedAt" desc);
create index "password_reset_flows_dispatch_idx"
  on "public"."password_reset_flows" ("dispatchId");
create index "password_reset_flows_resend_email_idx"
  on "public"."password_reset_flows" ("resendEmailId");
create index "password_reset_flows_status_requested_idx"
  on "public"."password_reset_flows" ("status", "requestedAt" desc);
create index "password_reset_flows_status_expires_idx"
  on "public"."password_reset_flows" ("status", "expiresAt");
create index "password_reset_events_flow_occurred_idx"
  on "public"."password_reset_events" ("flowId", "occurredAt" desc);
create index "password_reset_events_type_occurred_idx"
  on "public"."password_reset_events" ("type", "occurredAt" desc);
create index "password_reset_events_request_id_idx"
  on "public"."password_reset_events" ("requestId");

alter table "public"."password_reset_flows"
  add constraint "password_reset_flows_profileId_fkey"
  foreign key ("profileId")
  references "public"."corretor_studio_profiles"("id")
  on update cascade
  on delete set null;

alter table "public"."password_reset_events"
  add constraint "password_reset_events_flowId_fkey"
  foreign key ("flowId")
  references "public"."password_reset_flows"("id")
  on update cascade
  on delete cascade;

alter table "public"."password_reset_flows" enable row level security;
alter table "public"."password_reset_events" enable row level security;

revoke all on table "public"."password_reset_flows" from public, anon, authenticated;
revoke all on table "public"."password_reset_events" from public, anon, authenticated;
grant all on table "public"."password_reset_flows" to service_role;
grant all on table "public"."password_reset_events" to service_role;

create policy "password_reset_flows_service_role_all"
  on "public"."password_reset_flows"
  for all to service_role using (true) with check (true);

create policy "password_reset_events_service_role_all"
  on "public"."password_reset_events"
  for all to service_role using (true) with check (true);
