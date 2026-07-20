create type public."PublicFormApprovalStatus" as enum ('draft', 'pending_approval', 'approved', 'rejected');
create type public."PublicFormMappingTarget" as enum ('native_field', 'custom_field', 'notes', 'history');
create type public."PublicFormMetricType" as enum ('form_viewed', 'form_started', 'question_viewed', 'question_answered', 'question_skipped', 'form_completed', 'lead_created', 'lead_attached', 'meeting_scheduled');
create type public."PublicFormQuestionType" as enum ('text', 'email', 'phone', 'number', 'date', 'url', 'single_choice', 'multiple_choice', 'boolean', 'health_plan', 'crm_field', 'custom_field', 'scheduling', 'consent');
create type public."PublicFormRuleAction" as enum ('show', 'skip');
create type public."PublicFormRuleOperator" as enum ('equals', 'not_equals', 'contains', 'selected', 'not_selected');
create type public."PublicFormStatus" as enum ('draft', 'published', 'archived');
create type public."PublicFormSubmissionStatus" as enum ('processing', 'completed', 'failed');

create table public.corretor_studio_public_form_settings (
  id uuid primary key,
  "teamId" uuid not null unique references public.corretor_studio_teams(id) on update cascade on delete cascade,
  "approvalRequired" boolean not null default false,
  "approverRoles" public."UserRole"[] not null default array['manager'::public."UserRole"],
  "defaultBackgroundColor" varchar(7) not null default '#FFFFFF',
  "defaultTextColor" varchar(7) not null default '#18181B',
  "defaultLineColor" varchar(7) not null default '#E4E4E7',
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  constraint public_form_settings_background_color_check check ("defaultBackgroundColor" ~ '^#[0-9A-Fa-f]{6}$'),
  constraint public_form_settings_text_color_check check ("defaultTextColor" ~ '^#[0-9A-Fa-f]{6}$'),
  constraint public_form_settings_line_color_check check ("defaultLineColor" ~ '^#[0-9A-Fa-f]{6}$'),
  constraint public_form_settings_approver_roles_check check (not "approvalRequired" or cardinality("approverRoles") > 0)
);

create table public.corretor_studio_public_forms (
  id uuid primary key,
  "teamId" uuid not null references public.corretor_studio_teams(id) on update cascade on delete cascade,
  "createdById" uuid not null references public.corretor_studio_profiles(id) on update cascade on delete restrict,
  "assignedSdrId" uuid references public.corretor_studio_profiles(id) on update cascade on delete set null,
  "reviewedById" uuid references public.corretor_studio_profiles(id) on update cascade on delete set null,
  name text not null,
  description text,
  "publicId" uuid not null unique,
  status public."PublicFormStatus" not null default 'draft',
  "approvalStatus" public."PublicFormApprovalStatus" not null default 'draft',
  "coverTitle" text,
  "coverDescription" text,
  "ctaLabel" text not null default 'Começar',
  "successTitle" text not null default 'Respostas enviadas',
  "successDescription" text,
  "useDefaultTheme" boolean not null default true,
  "backgroundColor" varchar(7),
  "textColor" varchar(7),
  "lineColor" varchar(7),
  "schedulingEnabled" boolean not null default false,
  "meetingDurationMinutes" integer not null default 30,
  "schedulingMessage" text,
  "reviewComment" text,
  "reviewedAt" timestamptz(6),
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  constraint public_forms_name_check check (length(btrim(name)) > 0),
  constraint public_forms_meeting_duration_check check ("meetingDurationMinutes" between 5 and 480),
  constraint public_forms_background_color_check check ("backgroundColor" is null or "backgroundColor" ~ '^#[0-9A-Fa-f]{6}$'),
  constraint public_forms_text_color_check check ("textColor" is null or "textColor" ~ '^#[0-9A-Fa-f]{6}$'),
  constraint public_forms_line_color_check check ("lineColor" is null or "lineColor" ~ '^#[0-9A-Fa-f]{6}$')
);

create index public_forms_team_status_updated_idx on public.corretor_studio_public_forms ("teamId", status, "updatedAt" desc);
create index public_forms_team_approval_updated_idx on public.corretor_studio_public_forms ("teamId", "approvalStatus", "updatedAt" desc);
create index public_forms_assigned_sdr_idx on public.corretor_studio_public_forms ("assignedSdrId");

create table public.corretor_studio_public_form_eligible_closers (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  "profileId" uuid not null references public.corretor_studio_profiles(id) on update cascade on delete cascade,
  "createdAt" timestamptz(6) not null default current_timestamp,
  unique ("formId", "profileId")
);

create index public_form_eligible_closers_profile_idx on public.corretor_studio_public_form_eligible_closers ("profileId");

create table public.corretor_studio_public_form_questions (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  type public."PublicFormQuestionType" not null,
  title text not null,
  description text,
  placeholder text,
  required boolean not null default false,
  position integer not null,
  config jsonb not null default '{}'::jsonb,
  "mappingTarget" public."PublicFormMappingTarget",
  "mappingKey" text,
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  unique ("formId", position),
  constraint public_form_questions_title_check check (length(btrim(title)) > 0),
  constraint public_form_questions_position_check check (position >= 0)
);

create index public_form_questions_form_position_idx on public.corretor_studio_public_form_questions ("formId", position);

create table public.corretor_studio_public_form_options (
  id uuid primary key,
  "questionId" uuid not null references public.corretor_studio_public_form_questions(id) on update cascade on delete cascade,
  label text not null,
  value text not null,
  position integer not null,
  score integer not null default 0,
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  unique ("questionId", position),
  constraint public_form_options_label_check check (length(btrim(label)) > 0),
  constraint public_form_options_value_check check (length(btrim(value)) > 0),
  constraint public_form_options_position_check check (position >= 0)
);

create index public_form_options_question_position_idx on public.corretor_studio_public_form_options ("questionId", position);

create table public.corretor_studio_public_form_rules (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  "sourceQuestionId" uuid not null references public.corretor_studio_public_form_questions(id) on update cascade on delete cascade,
  "targetQuestionId" uuid not null references public.corretor_studio_public_form_questions(id) on update cascade on delete cascade,
  operator public."PublicFormRuleOperator" not null,
  "comparisonValue" jsonb,
  action public."PublicFormRuleAction" not null,
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  constraint public_form_rules_distinct_questions_check check ("sourceQuestionId" <> "targetQuestionId")
);

create index public_form_rules_form_idx on public.corretor_studio_public_form_rules ("formId");
create index public_form_rules_source_idx on public.corretor_studio_public_form_rules ("sourceQuestionId");
create index public_form_rules_target_idx on public.corretor_studio_public_form_rules ("targetQuestionId");

create table public.corretor_studio_public_form_score_bands (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  label text not null,
  summary text,
  "minScore" integer not null,
  "maxScore" integer not null,
  position integer not null,
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null,
  unique ("formId", position),
  constraint public_form_score_bands_range_check check ("minScore" <= "maxScore"),
  constraint public_form_score_bands_position_check check (position >= 0)
);

create index public_form_score_bands_range_idx on public.corretor_studio_public_form_score_bands ("formId", "minScore", "maxScore");

create table public.corretor_studio_public_form_publications (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  "publishedById" uuid not null references public.corretor_studio_profiles(id) on update cascade on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  "publishedAt" timestamptz(6) not null default current_timestamp,
  "endedAt" timestamptz(6),
  unique ("formId", version),
  constraint public_form_publications_version_check check (version > 0),
  constraint public_form_publications_period_check check ("endedAt" is null or "endedAt" >= "publishedAt")
);

create index public_form_publications_history_idx on public.corretor_studio_public_form_publications ("formId", "endedAt", "publishedAt" desc);
create unique index public_form_publications_one_active_idx on public.corretor_studio_public_form_publications ("formId") where "endedAt" is null;

create table public.corretor_studio_public_form_submissions (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete restrict,
  "publicationId" uuid not null references public.corretor_studio_public_form_publications(id) on update cascade on delete restrict,
  "leadId" uuid references public.corretor_studio_leads(id) on update cascade on delete set null,
  "requestKey" text not null unique,
  status public."PublicFormSubmissionStatus" not null default 'processing',
  score integer not null default 0,
  "scoreBandLabel" text,
  origin jsonb,
  "errorMessage" text,
  "submittedAt" timestamptz(6),
  "createdAt" timestamptz(6) not null default current_timestamp,
  "updatedAt" timestamptz(6) not null
);

create index public_form_submissions_form_created_idx on public.corretor_studio_public_form_submissions ("formId", "createdAt" desc);
create index public_form_submissions_publication_created_idx on public.corretor_studio_public_form_submissions ("publicationId", "createdAt" desc);
create index public_form_submissions_lead_submitted_idx on public.corretor_studio_public_form_submissions ("leadId", "submittedAt" desc);

create table public.corretor_studio_public_form_answers (
  id uuid primary key,
  "submissionId" uuid not null references public.corretor_studio_public_form_submissions(id) on update cascade on delete cascade,
  "questionId" uuid references public.corretor_studio_public_form_questions(id) on update cascade on delete set null,
  value jsonb not null,
  "questionSnapshot" jsonb not null,
  "createdAt" timestamptz(6) not null default current_timestamp,
  unique ("submissionId", "questionId")
);

create index public_form_answers_submission_idx on public.corretor_studio_public_form_answers ("submissionId");
create index public_form_answers_question_idx on public.corretor_studio_public_form_answers ("questionId");

create table public.corretor_studio_public_form_metric_events (
  id uuid primary key,
  "formId" uuid not null references public.corretor_studio_public_forms(id) on update cascade on delete cascade,
  "publicationId" uuid not null references public.corretor_studio_public_form_publications(id) on update cascade on delete cascade,
  "questionId" uuid references public.corretor_studio_public_form_questions(id) on update cascade on delete set null,
  "visitorSessionId" text not null,
  "eventType" public."PublicFormMetricType" not null,
  "eventKey" text not null unique,
  origin jsonb,
  "createdAt" timestamptz(6) not null default current_timestamp
);

create index public_form_metric_events_publication_type_created_idx on public.corretor_studio_public_form_metric_events ("publicationId", "eventType", "createdAt");
create index public_form_metric_events_form_created_idx on public.corretor_studio_public_form_metric_events ("formId", "createdAt" desc);
create index public_form_metric_events_session_created_idx on public.corretor_studio_public_form_metric_events ("visitorSessionId", "createdAt");
