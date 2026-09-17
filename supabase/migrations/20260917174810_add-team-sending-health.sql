create type "public"."email_import_risk_level" as enum ('low', 'medium', 'high');

create type "public"."email_sending_health_status" as enum ('healthy', 'warned', 'paused', 'suspended');

alter type "public"."notification_type" rename to "notification_type__old_version_to_be_dropped";

create type "public"."notification_type" as enum ('ACTIVITY_MENTION', 'ACTIVITY_REACTION', 'TEAM_MEMBER_ADDED', 'TEAM_MEMBER_REMOVED', 'LEAD_SCHEDULE_CREATED', 'LEAD_PROPOSAL_PENDING', 'GOOGLE_CONNECTION_BROKEN', 'LEAD_TRANSFER_ACTIVATED', 'MEETING_REMINDER', 'LEAD_TRANSFER_SCHEDULE_FAILED', 'MEETING_FOLLOW_UP_DIGEST', 'BETHANIA_AUTH_CODE', 'EMAIL_IMPORT_COMPLETED', 'EMAIL_CAMPAIGN_DISPATCH_FAILED', 'AUTOMATION_RULE', 'WEBHOOK_AUTO_PAUSED', 'LEAD_DOCUMENT_UPLOADED', 'LEAD_DOCUMENT_REQUEST_COMPLETED', 'EMAIL_SENDING_HEALTH_CHANGED');

alter table "public"."corretor_studio_notifications" alter column type type "public"."notification_type" using type::text::"public"."notification_type";

drop type "public"."notification_type__old_version_to_be_dropped";

alter table "public"."corretor_studio_email_contact_lists" add column "isQuarantined" boolean not null default false;

alter table "public"."corretor_studio_email_contact_lists" add column "quarantineReason" text;

alter table "public"."corretor_studio_email_contact_lists" add column "quarantineReleasedAt" timestamp(6) with time zone;

alter table "public"."corretor_studio_email_contact_lists" add column "quarantineReleasedBy" uuid;

alter table "public"."corretor_studio_email_contact_lists" add column "quarantinedAt" timestamp(6) with time zone;

alter table "public"."corretor_studio_email_import_jobs" add column "riskLevel" public.email_import_risk_level;

alter table "public"."corretor_studio_email_import_jobs" add column "validationCounts" jsonb;

alter table "public"."email_team_settings" add column "sendingHealthChangedAt" timestamp(6) with time zone;

alter table "public"."email_team_settings" add column "sendingHealthMetrics" jsonb;

alter table "public"."email_team_settings" add column "sendingHealthReason" text;

alter table "public"."email_team_settings" add column "sendingHealthStatus" public.email_sending_health_status not null default 'healthy'::public.email_sending_health_status;
