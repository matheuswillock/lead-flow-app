create type "public"."ActivityType" as enum ('note', 'call', 'whatsapp', 'email', 'status_change', 'task');

create type "public"."BackofficeInviteDispatchStatus" as enum ('sent_google', 'sent_resend', 'failed');

create type "public"."InviteDispatchStatus" as enum ('sent_google', 'sent_resend', 'failed');

create type "public"."LeadStatus" as enum ('new_opportunity', 'scheduled', 'no_show', 'pricingRequest', 'future_sale', 'offerNegotiation', 'pending_documents', 'offerSubmission', 'dps_agreement', 'invoicePayment', 'disqualified', 'opportunityLost', 'operator_denied', 'contract_finalized');

create type "public"."MeetingHeald" as enum ('yes', 'no');

create type "public"."TeamLeadTimeUnit" as enum ('hours', 'days');

create type "public"."TeamStatusRuleType" as enum ('disabled_status', 'lead_time', 'combined_transition');

create type "public"."UserFunction" as enum ('SDR', 'CLOSER');

create type "public"."UserRole" as enum ('manager', 'backoffice', 'operator');

create type "public"."backoffice_access_principal" as enum ('MASTER', 'MANAGER', 'BACKOFFICE', 'OPERATOR', 'SDR', 'CLOSER', 'CAN_MANAGE_TEAMS', 'CAN_CREATE_USERS');

create type "public"."backoffice_adhesion_billing_cycle" as enum ('monthly', 'quarterly', 'semiannual');

create type "public"."backoffice_adhesion_plan" as enum ('crm');

create type "public"."backoffice_adhesion_status" as enum ('pending', 'paid', 'overdue', 'expired', 'canceled');

create type "public"."backoffice_feature_access_level" as enum ('NONE', 'READ', 'FULL');

create type "public"."backoffice_feature_access_mode" as enum ('PUBLIC', 'PAID', 'ADDON');

create type "public"."backoffice_feature_grant_type" as enum ('BETA');

create type "public"."backoffice_lead_origin" as enum ('manual', 'webhook_meta');

create type "public"."backoffice_lead_status" as enum ('new_opportunity', 'scheduled', 'no_show', 'new_adhesion', 'lost', 'implementation', 'finalized');

create type "public"."backoffice_payment_method" as enum ('PIX', 'CREDIT_CARD');

create type "public"."backoffice_product_billing_mode" as enum ('RECURRING', 'LIFETIME');

create type "public"."backoffice_product_type" as enum ('PLAN', 'ADDON');

create type "public"."backoffice_subscription_status" as enum ('active', 'suspended', 'canceled', 'expired');

create type "public"."backoffice_webhook_event_status" as enum ('received', 'processed', 'failed');

create type "public"."backoffice_webhook_source" as enum ('meta');

create type "public"."backoffice_webhook_token_expiry_mode" as enum ('hours_24', 'months_6', 'indeterminate');

create type "public"."backoffice_webhook_token_status" as enum ('active', 'replaced', 'expired');

create type "public"."email_campaign_status" as enum ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed');

create type "public"."email_credit_plan" as enum ('starter', 'plus', 'pro', 'business');

create type "public"."email_credit_subscription_status" as enum ('active', 'suspended', 'canceled');

create type "public"."email_event_type" as enum ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'delivery_delayed', 'unsubscribed');

create type "public"."email_log_status" as enum ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed');

create type "public"."notification_type" as enum ('ACTIVITY_MENTION', 'ACTIVITY_REACTION', 'TEAM_MEMBER_ADDED', 'TEAM_MEMBER_REMOVED', 'LEAD_SCHEDULE_CREATED', 'LEAD_PROPOSAL_PENDING');

create type "public"."pending_action_status" as enum ('pending', 'applied', 'failed', 'canceled');

create type "public"."pending_action_type" as enum ('create_team', 'add_member', 'add_user', 'transfer_team', 'update_subscription_credits');

create type "public"."portfolio_source" as enum ('crm', 'manual', 'brokerage_transfer');

create type "public"."portfolio_status" as enum ('active', 'pending', 'canceled');

create type "public"."studio_webhook_token_expiry_mode" as enum ('hours_24', 'months_6', 'indeterminate');

create type "public"."subscription_plan" as enum ('free_trial', 'manager_base', 'with_operators');

create type "public"."subscription_status" as enum ('trial', 'active', 'past_due', 'suspended', 'canceled');

create type "public"."task_assignee_status" as enum ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELED', 'OVERDUE');

create type "public"."task_type" as enum ('call', 'documentation', 'email', 'proposal', 'whatsapp', 'meeting', 'other');


  create table "public"."backoffice_adhesions" (
    "id" uuid not null,
    "leadId" uuid not null,
    "fullName" text not null,
    "phone" text not null,
    "email" text,
    "cpfCnpj" text,
    "postalCode" text,
    "address" text,
    "addressNumber" text,
    "neighborhood" text,
    "complement" text,
    "city" text,
    "state" text,
    "plan" public.backoffice_adhesion_plan not null default 'crm'::public.backoffice_adhesion_plan,
    "cycle" public.backoffice_adhesion_billing_cycle not null,
    "modules" text[] default ARRAY['crm'::text],
    "extraTeams" integer not null default 0,
    "extraUsers" integer not null default 0,
    "monthlyBaseAmount" numeric(12,2) not null,
    "monthlyExtraTeamsAmount" numeric(12,2) not null,
    "monthlyExtraUsersAmount" numeric(12,2) not null,
    "monthlyTotalAmount" numeric(12,2) not null,
    "totalAmount" numeric(12,2) not null,
    "tokenHash" text not null,
    "tokenPreview" text not null,
    "expiresAt" timestamp(6) with time zone not null,
    "status" public.backoffice_adhesion_status not null default 'pending'::public.backoffice_adhesion_status,
    "tokenPlain" text,
    "sdrBackofficeUserId" uuid,
    "closerBackofficeUserId" uuid,
    "createdByBackofficeUserId" uuid,
    "asaasCustomerId" text,
    "asaasPaymentId" text,
    "asaasInstallmentId" text,
    "installmentCount" integer,
    "billingType" text,
    "paymentDueDate" timestamp(6) with time zone,
    "invoiceUrl" text,
    "bankSlipUrl" text,
    "pixQrCode" text,
    "pixPayload" text,
    "paidAt" timestamp(6) with time zone,
    "overdueAt" timestamp(6) with time zone,
    "canceledAt" timestamp(6) with time zone,
    "createdProfileId" uuid,
    "createdSupabaseId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_clients" (
    "id" uuid not null,
    "fullName" text not null,
    "email" text,
    "phone" text,
    "cpfCnpj" text,
    "notes" text,
    "asaasCustomerId" text,
    "isActive" boolean not null default true,
    "createdByProfileId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."backoffice_feature_access_rules" (
    "id" uuid not null default gen_random_uuid(),
    "featureId" uuid not null,
    "principal" public.backoffice_access_principal not null,
    "accessLevel" public.backoffice_feature_access_level not null,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_feature_grants" (
    "id" uuid not null,
    "featureId" uuid not null,
    "profileId" uuid not null,
    "grantType" public.backoffice_feature_grant_type not null default 'BETA'::public.backoffice_feature_grant_type,
    "accessLevel" public.backoffice_feature_access_level not null default 'FULL'::public.backoffice_feature_access_level,
    "isActive" boolean not null default true,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_features" (
    "id" uuid not null,
    "slug" text not null,
    "name" text not null,
    "description" text,
    "parentId" uuid,
    "productSlug" text,
    "accessMode" public.backoffice_feature_access_mode not null default 'PUBLIC'::public.backoffice_feature_access_mode,
    "defaultAccessLevel" public.backoffice_feature_access_level not null default 'FULL'::public.backoffice_feature_access_level,
    "betaEnabled" boolean not null default false,
    "inheritParentSettings" boolean not null default false,
    "isActive" boolean not null default true,
    "sortOrder" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_leads" (
    "id" uuid not null,
    "name" text not null,
    "email" text,
    "phone" text,
    "cpfCnpj" text,
    "notes" text,
    "status" public.backoffice_lead_status not null default 'new_opportunity'::public.backoffice_lead_status,
    "origin" public.backoffice_lead_origin not null default 'manual'::public.backoffice_lead_origin,
    "sourceExternalId" text,
    "sourceWebhookEventId" uuid,
    "sdrBackofficeUserId" uuid,
    "closerBackofficeUserId" uuid,
    "meetingDate" timestamp(6) with time zone,
    "meetingTitle" text,
    "meetingNotes" text,
    "meetingLink" text,
    "meetingExtraGuests" text[] default ARRAY[]::text[],
    "statusEnteredAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "createdByProfileId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_leads_schedule" (
    "id" uuid not null,
    "leadId" uuid not null,
    "closerBackofficeUserId" uuid,
    "date" timestamp(6) with time zone not null,
    "meetingTitle" text,
    "notes" text,
    "meetingLink" text,
    "extraGuests" text[] default ARRAY[]::text[],
    "googleEventId" text,
    "googleCalendarId" text,
    "inviteDispatchStatus" public."BackofficeInviteDispatchStatus",
    "inviteDispatchProvider" text,
    "inviteDispatchFallbackUsed" boolean not null default false,
    "inviteDispatchLastAttemptAt" timestamp(6) with time zone,
    "inviteDispatchLastError" text,
    "inviteDispatchLastPayload" jsonb,
    "isCanceled" boolean not null default false,
    "canceledAt" timestamp(6) with time zone,
    "canceledByProfileId" uuid,
    "cancelReason" text,
    "createdByProfileId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_payments" (
    "id" uuid not null,
    "clientId" uuid not null,
    "asaasPaymentId" text,
    "billingType" text not null default 'PIX'::text,
    "status" text not null default 'PENDING'::text,
    "amount" numeric(12,2) not null,
    "dueDate" timestamp(6) with time zone,
    "description" text,
    "invoiceUrl" text,
    "pixQrCode" text,
    "pixPayload" text,
    "createdByProfileId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."backoffice_product_payment_rules" (
    "id" uuid not null default gen_random_uuid(),
    "productId" uuid not null,
    "paymentMethod" public.backoffice_payment_method not null,
    "billingCycle" public.backoffice_adhesion_billing_cycle not null,
    "price" numeric(10,2) not null,
    "canInstallment" boolean not null default false,
    "maxInstallments" integer not null default 1,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."backoffice_products" (
    "id" uuid not null,
    "name" text not null,
    "slug" text not null,
    "description" text,
    "type" public.backoffice_product_type not null,
    "billingMode" public.backoffice_product_billing_mode not null default 'RECURRING'::public.backoffice_product_billing_mode,
    "priceMonthly" numeric(10,2),
    "priceQuarterly" numeric(10,2),
    "priceSemiannual" numeric(10,2),
    "priceLifetime" numeric(10,2),
    "isActive" boolean not null default true,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_user_subscriptions" (
    "id" uuid not null,
    "profileId" uuid not null,
    "productId" uuid not null,
    "status" public.backoffice_subscription_status not null default 'active'::public.backoffice_subscription_status,
    "cycle" public.backoffice_adhesion_billing_cycle,
    "startDate" timestamp(6) with time zone not null,
    "endDate" timestamp(6) with time zone,
    "adhesionId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."backoffice_users" (
    "id" uuid not null,
    "profileId" uuid not null,
    "email" text not null,
    "fullAccess" boolean not null default false,
    "isActive" boolean not null default true,
    "isSdr" boolean not null default true,
    "isCloser" boolean not null default true,
    "googleCalendarConnected" boolean not null default false,
    "googleAccessToken" text,
    "googleRefreshToken" text,
    "googleTokenExpiresAt" timestamp(6) with time zone,
    "googleEmail" text,
    "timezone" text not null default 'America/Sao_Paulo'::text,
    "mailboxStatus" text not null default 'pending_manual_action'::text,
    "mailboxAddress" text,
    "mailboxProvisionedAt" timestamp(6) with time zone,
    "createdByProfileId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."backoffice_webhook_events" (
    "id" uuid not null,
    "source" public.backoffice_webhook_source not null,
    "eventType" text,
    "payload" jsonb not null,
    "signature" text,
    "status" public.backoffice_webhook_event_status not null default 'received'::public.backoffice_webhook_event_status,
    "errorMessage" text,
    "receivedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "processedAt" timestamp(6) with time zone
      );



  create table "public"."backoffice_webhook_request_logs" (
    "id" uuid not null,
    "source" public.backoffice_webhook_source not null,
    "method" text not null,
    "endpoint" text not null,
    "statusCode" integer not null,
    "resultType" text not null,
    "requestPayload" jsonb,
    "responsePayload" jsonb,
    "errorMessage" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."backoffice_webhook_tokens" (
    "id" uuid not null,
    "source" public.backoffice_webhook_source not null,
    "tokenHash" text not null,
    "tokenCipher" text not null,
    "tokenPreview" text not null,
    "status" public.backoffice_webhook_token_status not null default 'active'::public.backoffice_webhook_token_status,
    "expiryMode" public.backoffice_webhook_token_expiry_mode not null default 'indeterminate'::public.backoffice_webhook_token_expiry_mode,
    "expiresAt" timestamp(6) with time zone,
    "lastUsedAt" timestamp(6) with time zone,
    "generatedByBackofficeUserId" uuid not null,
    "generatedByEmailSnapshot" text not null,
    "generatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_campaigns" (
    "id" uuid not null,
    "teamId" uuid not null,
    "createdBy" uuid not null,
    "name" text not null,
    "templateId" uuid not null,
    "contactListId" uuid not null,
    "status" public.email_campaign_status not null default 'draft'::public.email_campaign_status,
    "scheduledAt" timestamp(6) with time zone,
    "sentAt" timestamp(6) with time zone,
    "totalRecipients" integer not null default 0,
    "totalSent" integer not null default 0,
    "totalDelivered" integer not null default 0,
    "totalOpened" integer not null default 0,
    "totalClicked" integer not null default 0,
    "totalBounced" integer not null default 0,
    "totalComplained" integer not null default 0,
    "errorMessage" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_contact_lists" (
    "id" uuid not null,
    "teamId" uuid not null,
    "createdBy" uuid not null,
    "name" text not null,
    "description" text,
    "csvStoragePath" text,
    "totalContacts" integer not null default 0,
    "isArchived" boolean not null default false,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_contacts" (
    "id" uuid not null,
    "listId" uuid not null,
    "email" text not null,
    "name" text,
    "customFields" jsonb,
    "isUnsubscribed" boolean not null default false,
    "isBounced" boolean not null default false,
    "isComplained" boolean not null default false,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_credit_subscriptions" (
    "id" uuid not null,
    "profileId" uuid not null,
    "plan" public.email_credit_plan not null,
    "monthlyCredits" integer not null,
    "status" public.email_credit_subscription_status not null default 'active'::public.email_credit_subscription_status,
    "currentPeriodStart" timestamp(6) with time zone not null,
    "currentPeriodEnd" timestamp(6) with time zone not null,
    "canceledAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_credit_usages" (
    "id" uuid not null,
    "subscriptionId" uuid not null,
    "periodStart" timestamp(6) with time zone not null,
    "periodEnd" timestamp(6) with time zone not null,
    "creditsUsed" integer not null default 0,
    "overageCount" integer not null default 0,
    "overageCharged" numeric(12,2) not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_events" (
    "id" uuid not null,
    "logId" uuid not null,
    "type" public.email_event_type not null,
    "occurredAt" timestamp(6) with time zone not null,
    "metadata" jsonb,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_email_logs" (
    "id" uuid not null,
    "teamId" uuid not null,
    "campaignId" uuid,
    "resendEmailId" text,
    "recipientEmail" text not null,
    "recipientName" text,
    "subject" text not null,
    "status" public.email_log_status not null default 'queued'::public.email_log_status,
    "sentAt" timestamp(6) with time zone,
    "deliveredAt" timestamp(6) with time zone,
    "openedAt" timestamp(6) with time zone,
    "clickedAt" timestamp(6) with time zone,
    "bouncedAt" timestamp(6) with time zone,
    "complainedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_email_templates" (
    "id" uuid not null,
    "teamId" uuid not null,
    "createdBy" uuid not null,
    "name" text not null,
    "subject" text not null,
    "previewText" text,
    "mailyJson" jsonb,
    "html" text,
    "isArchived" boolean not null default false,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_health_plan_options" (
    "id" uuid not null,
    "name" text not null,
    "normalizedName" text not null,
    "createdBy" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_lead_activities" (
    "id" uuid not null,
    "leadId" uuid not null,
    "type" public."ActivityType" not null,
    "body" text,
    "payload" jsonb,
    "createdBy" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_lead_activity_reactions" (
    "id" uuid not null,
    "activityId" uuid not null,
    "profileId" uuid not null,
    "emoji" text not null,
    "emojiUnified" text not null,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_lead_attachments" (
    "id" uuid not null,
    "leadId" uuid not null,
    "fileName" text not null,
    "fileUrl" text not null,
    "storagePath" text not null default ''::text,
    "fileType" text not null,
    "fileSize" integer not null,
    "uploadedBy" uuid not null,
    "uploadedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_lead_finalized" (
    "id" uuid not null,
    "leadId" uuid not null,
    "finalizedDateAt" timestamp(6) with time zone not null,
    "startDateAt" timestamp(6) with time zone not null,
    "duration" integer not null,
    "amount" numeric(12,2) not null,
    "notes" text,
    "closerId" uuid,
    "operadora" text,
    "productName" text,
    "contractFileUrl" text,
    "contractStoragePath" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_lead_finalized_dependents" (
    "id" uuid not null,
    "leadFinalizedId" uuid not null,
    "name" text not null,
    "birthDate" date not null,
    "parentesco" text not null,
    "document" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_lead_finalized_holders" (
    "id" uuid not null,
    "leadFinalizedId" uuid not null,
    "name" text not null,
    "birthDate" date not null,
    "document" text not null,
    "cnpj" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_lead_portfolio" (
    "id" uuid not null,
    "leadId" uuid not null,
    "teamId" uuid not null,
    "portfolioStatus" public.portfolio_status not null default 'active'::public.portfolio_status,
    "source" public.portfolio_source not null default 'crm'::public.portfolio_source,
    "note" text,
    "lastContactAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_leads" (
    "id" uuid not null,
    "leadCode" text not null,
    "managerId" uuid not null,
    "teamId" uuid,
    "assignedTo" uuid,
    "closerId" uuid,
    "status" public."LeadStatus" not null default 'new_opportunity'::public."LeadStatus",
    "name" text not null,
    "email" text,
    "phone" text,
    "cnpj" text,
    "age" text,
    "currentHealthPlan" text,
    "currentValue" numeric(12,2),
    "referenceHospital" text,
    "currentTreatment" text,
    "meetingDate" timestamp(6) with time zone,
    "meetingTitle" text,
    "meetingNotes" text,
    "meetingLink" text,
    "meetingHeald" public."MeetingHeald",
    "followUpAt" timestamp(6) with time zone,
    "followUpNotes" text,
    "followUpSourceStatus" public."LeadStatus",
    "lossReason" text,
    "lossReasonDetails" text,
    "statusEnteredAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "notes" text,
    "ticket" numeric(12,2),
    "contractDueDate" timestamp(6) with time zone,
    "soldPlan" text,
    "createdBy" uuid,
    "updatedBy" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_leads_schedule" (
    "id" uuid not null,
    "leadId" uuid not null,
    "date" timestamp(6) with time zone not null,
    "noShowCount" integer not null default 0,
    "meetingTitle" text,
    "notes" text,
    "meetingLink" text,
    "extraGuests" text[] default ARRAY[]::text[],
    "googleEventId" text,
    "googleCalendarId" text,
    "inviteDispatchStatus" public."InviteDispatchStatus",
    "inviteDispatchFallbackUsed" boolean not null default false,
    "inviteDispatchLastAttemptAt" timestamp(6) with time zone,
    "inviteDispatchLastError" text,
    "inviteDispatchLastPayload" jsonb,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_notifications" (
    "id" uuid not null,
    "recipientProfileId" uuid not null,
    "actorProfileId" uuid,
    "teamId" uuid not null,
    "type" public.notification_type not null,
    "message" text not null,
    "metadata" jsonb,
    "isRead" boolean not null default false,
    "readAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_pending_actions" (
    "id" uuid not null,
    "masterId" uuid not null,
    "teamId" uuid,
    "actionType" public.pending_action_type not null,
    "status" public.pending_action_status not null default 'pending'::public.pending_action_status,
    "payload" jsonb not null,
    "checkoutId" text,
    "paymentId" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_pending_operators" (
    "id" uuid not null,
    "managerId" uuid not null,
    "teamId" uuid,
    "name" text not null,
    "email" text not null,
    "role" text not null,
    "functions" public."UserFunction"[] default ARRAY[]::public."UserFunction"[],
    "paymentId" text,
    "subscriptionId" text,
    "paymentStatus" text not null,
    "paymentMethod" text not null,
    "operatorCreated" boolean not null default false,
    "operatorId" uuid,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_profile_subscription_capacities" (
    "id" uuid not null default gen_random_uuid(),
    "profileSubscriptionId" uuid not null,
    "includedExtraTeams" integer not null default 0,
    "includedExtraUsers" integer not null default 0,
    "manualAdjustmentExtraTeams" integer not null default 0,
    "manualAdjustmentExtraUsers" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_profile_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "profileId" uuid not null,
    "adhesionId" uuid,
    "productId" uuid,
    "asaasSubscriptionId" text,
    "asaasInstallmentId" text,
    "subscriptionStatus" public.subscription_status,
    "subscriptionPlan" public.subscription_plan,
    "subscriptionStartDate" timestamp(6) with time zone,
    "subscriptionEndDate" timestamp(6) with time zone,
    "trialEndDate" timestamp(6) with time zone,
    "subscriptionNextDueDate" timestamp(6) with time zone,
    "subscriptionCycle" text,
    "subscriptionLastSyncedAt" timestamp(6) with time zone,
    "hasPermanentSubscription" boolean not null default false,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_profiles" (
    "id" uuid not null,
    "email" text not null,
    "supabaseId" uuid,
    "fullName" text,
    "phone" text,
    "cpfCnpj" text,
    "postalCode" text,
    "address" text,
    "addressNumber" text,
    "neighborhood" text,
    "complement" text,
    "city" text,
    "state" text,
    "profileIconId" text,
    "profileIconUrl" text,
    "role" public."UserRole" not null default 'manager'::public."UserRole",
    "functions" public."UserFunction"[] default ARRAY[]::public."UserFunction"[],
    "isMaster" boolean not null default false,
    "canCreateAccountUsers" boolean not null default false,
    "canManageAccountTeams" boolean not null default false,
    "hasPermanentSubscription" boolean not null default false,
    "googleCalendarConnected" boolean not null default false,
    "googleAccessToken" text,
    "googleRefreshToken" text,
    "googleTokenExpiresAt" timestamp(6) with time zone,
    "googleEmail" text,
    "managerId" uuid,
    "asaasCustomerId" text,
    "subscriptionId" text,
    "subscriptionStatus" public.subscription_status,
    "subscriptionPlan" public.subscription_plan,
    "operatorCount" integer not null default 0,
    "subscriptionStartDate" timestamp(6) with time zone,
    "subscriptionEndDate" timestamp(6) with time zone,
    "trialEndDate" timestamp(6) with time zone,
    "asaasSubscriptionId" text,
    "subscriptionNextDueDate" timestamp(6) with time zone,
    "subscriptionCycle" text,
    "activeTeamId" uuid,
    "timezone" text not null default 'America/Sao_Paulo'::text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_task_assignees" (
    "id" uuid not null,
    "taskId" uuid not null,
    "profileId" uuid not null,
    "status" public.task_assignee_status not null default 'PENDING'::public.task_assignee_status,
    "googleEventId" text,
    "googleCalendarId" text,
    "googleSynced" boolean not null default false,
    "assignedAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_tasks" (
    "id" uuid not null,
    "leadId" uuid not null,
    "activityId" uuid,
    "title" text not null,
    "taskType" public.task_type not null,
    "body" text not null,
    "isUrgent" boolean not null default false,
    "startAt" timestamp(6) with time zone,
    "endAt" timestamp(6) with time zone,
    "createdBy" uuid not null,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_team_filter_presets" (
    "id" uuid not null,
    "teamId" uuid not null,
    "createdBy" uuid not null,
    "name" text not null,
    "description" text,
    "queryJson" jsonb not null,
    "lastUsedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_team_members" (
    "id" uuid not null,
    "teamId" uuid not null,
    "profileId" uuid not null,
    "role" public."UserRole" not null,
    "functions" public."UserFunction"[] default ARRAY[]::public."UserFunction"[],
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_team_status_rules" (
    "id" uuid not null,
    "teamId" uuid not null,
    "createdBy" uuid not null,
    "type" public."TeamStatusRuleType" not null,
    "targetStatus" public."LeadStatus" not null,
    "requiredStatus" public."LeadStatus",
    "leadTimeValue" integer,
    "leadTimeUnit" public."TeamLeadTimeUnit",
    "requireConfirmation" boolean not null default false,
    "confirmationMessage" text,
    "isEnabled" boolean not null default true,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_team_studio_webhook_configs" (
    "id" uuid not null,
    "teamId" uuid not null,
    "tokenHash" text not null,
    "tokenCipher" text,
    "tokenPreview" text not null,
    "expiryMode" public.studio_webhook_token_expiry_mode not null default 'indeterminate'::public.studio_webhook_token_expiry_mode,
    "expiresAt" timestamp(6) with time zone,
    "lastUsedAt" timestamp(6) with time zone,
    "updatedByProfileId" uuid not null,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );



  create table "public"."corretor_studio_team_studio_webhook_request_logs" (
    "id" uuid not null,
    "teamId" uuid not null,
    "method" text not null,
    "endpoint" text not null,
    "statusCode" integer not null,
    "resultType" text not null,
    "requestPayload" jsonb,
    "responsePayload" jsonb,
    "errorMessage" text,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."corretor_studio_teams" (
    "id" uuid not null,
    "name" text not null,
    "masterId" uuid not null,
    "isDefault" boolean not null default false,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );


CREATE UNIQUE INDEX "backoffice_adhesions_asaasPaymentId_key" ON public.backoffice_adhesions USING btree ("asaasPaymentId");

CREATE UNIQUE INDEX backoffice_adhesions_asaasinstallmentid_key ON public.backoffice_adhesions USING btree ("asaasInstallmentId");

CREATE INDEX backoffice_adhesions_closer_user_id_idx ON public.backoffice_adhesions USING btree ("closerBackofficeUserId");

CREATE INDEX backoffice_adhesions_expires_at_idx ON public.backoffice_adhesions USING btree ("expiresAt");

CREATE UNIQUE INDEX "backoffice_adhesions_leadId_key" ON public.backoffice_adhesions USING btree ("leadId");

CREATE INDEX backoffice_adhesions_lead_id_idx ON public.backoffice_adhesions USING btree ("leadId");

CREATE UNIQUE INDEX backoffice_adhesions_pkey ON public.backoffice_adhesions USING btree (id);

CREATE INDEX backoffice_adhesions_sdr_user_id_idx ON public.backoffice_adhesions USING btree ("sdrBackofficeUserId");

CREATE INDEX backoffice_adhesions_status_idx ON public.backoffice_adhesions USING btree (status);

CREATE UNIQUE INDEX "backoffice_adhesions_tokenHash_key" ON public.backoffice_adhesions USING btree ("tokenHash");

CREATE UNIQUE INDEX "backoffice_clients_asaasCustomerId_key" ON public.backoffice_clients USING btree ("asaasCustomerId");

CREATE INDEX backoffice_clients_cpf_cnpj_idx ON public.backoffice_clients USING btree ("cpfCnpj");

CREATE INDEX backoffice_clients_email_idx ON public.backoffice_clients USING btree (email);

CREATE INDEX backoffice_clients_is_active_idx ON public.backoffice_clients USING btree ("isActive");

CREATE UNIQUE INDEX backoffice_clients_pkey ON public.backoffice_clients USING btree (id);

CREATE INDEX backoffice_feature_access_rules_feature_id_idx ON public.backoffice_feature_access_rules USING btree ("featureId");

CREATE UNIQUE INDEX backoffice_feature_access_rules_feature_principal_key ON public.backoffice_feature_access_rules USING btree ("featureId", principal);

CREATE UNIQUE INDEX backoffice_feature_access_rules_pkey ON public.backoffice_feature_access_rules USING btree (id);

CREATE INDEX backoffice_feature_grants_feature_active_idx ON public.backoffice_feature_grants USING btree ("featureId", "isActive");

CREATE UNIQUE INDEX backoffice_feature_grants_feature_profile_grant_type_key ON public.backoffice_feature_grants USING btree ("featureId", "profileId", "grantType");

CREATE UNIQUE INDEX backoffice_feature_grants_pkey ON public.backoffice_feature_grants USING btree (id);

CREATE INDEX backoffice_feature_grants_profile_grant_type_active_idx ON public.backoffice_feature_grants USING btree ("profileId", "grantType", "isActive");

CREATE INDEX backoffice_features_active_sort_idx ON public.backoffice_features USING btree ("isActive", "sortOrder");

CREATE INDEX backoffice_features_parent_id_idx ON public.backoffice_features USING btree ("parentId");

CREATE UNIQUE INDEX backoffice_features_pkey ON public.backoffice_features USING btree (id);

CREATE INDEX backoffice_features_product_slug_idx ON public.backoffice_features USING btree ("productSlug");

CREATE UNIQUE INDEX backoffice_features_slug_key ON public.backoffice_features USING btree (slug);

CREATE INDEX backoffice_leads_closer_user_id_idx ON public.backoffice_leads USING btree ("closerBackofficeUserId");

CREATE INDEX backoffice_leads_cpf_cnpj_idx ON public.backoffice_leads USING btree ("cpfCnpj");

CREATE INDEX backoffice_leads_created_by_profile_id_idx ON public.backoffice_leads USING btree ("createdByProfileId");

CREATE INDEX backoffice_leads_email_idx ON public.backoffice_leads USING btree (email);

CREATE INDEX backoffice_leads_meeting_date_idx ON public.backoffice_leads USING btree ("meetingDate");

CREATE INDEX backoffice_leads_origin_idx ON public.backoffice_leads USING btree (origin);

CREATE UNIQUE INDEX backoffice_leads_pkey ON public.backoffice_leads USING btree (id);

CREATE INDEX backoffice_leads_schedule_closer_user_id_idx ON public.backoffice_leads_schedule USING btree ("closerBackofficeUserId");

CREATE INDEX backoffice_leads_schedule_date_idx ON public.backoffice_leads_schedule USING btree (date);

CREATE INDEX backoffice_leads_schedule_is_canceled_idx ON public.backoffice_leads_schedule USING btree ("isCanceled");

CREATE INDEX backoffice_leads_schedule_lead_id_idx ON public.backoffice_leads_schedule USING btree ("leadId");

CREATE UNIQUE INDEX backoffice_leads_schedule_pkey ON public.backoffice_leads_schedule USING btree (id);

CREATE INDEX backoffice_leads_sdr_user_id_idx ON public.backoffice_leads USING btree ("sdrBackofficeUserId");

CREATE UNIQUE INDEX backoffice_leads_source_external_id_key ON public.backoffice_leads USING btree ("sourceExternalId");

CREATE UNIQUE INDEX backoffice_leads_source_webhook_event_id_key ON public.backoffice_leads USING btree ("sourceWebhookEventId");

CREATE INDEX backoffice_leads_status_idx ON public.backoffice_leads USING btree (status);

CREATE UNIQUE INDEX "backoffice_payments_asaasPaymentId_key" ON public.backoffice_payments USING btree ("asaasPaymentId");

CREATE INDEX backoffice_payments_client_id_idx ON public.backoffice_payments USING btree ("clientId");

CREATE INDEX backoffice_payments_due_date_idx ON public.backoffice_payments USING btree ("dueDate");

CREATE UNIQUE INDEX backoffice_payments_pkey ON public.backoffice_payments USING btree (id);

CREATE INDEX backoffice_payments_status_idx ON public.backoffice_payments USING btree (status);

CREATE UNIQUE INDEX backoffice_product_payment_rules_pkey ON public.backoffice_product_payment_rules USING btree (id);

CREATE INDEX backoffice_product_payment_rules_productid_idx ON public.backoffice_product_payment_rules USING btree ("productId");

CREATE UNIQUE INDEX backoffice_product_payment_rules_unique ON public.backoffice_product_payment_rules USING btree ("productId", "paymentMethod", "billingCycle");

CREATE UNIQUE INDEX backoffice_products_pkey ON public.backoffice_products USING btree (id);

CREATE INDEX backoffice_products_slug_idx ON public.backoffice_products USING btree (slug);

CREATE UNIQUE INDEX backoffice_products_slug_key ON public.backoffice_products USING btree (slug);

CREATE INDEX "backoffice_products_type_isActive_idx" ON public.backoffice_products USING btree (type, "isActive");

CREATE INDEX "backoffice_user_subscriptions_adhesionId_idx" ON public.backoffice_user_subscriptions USING btree ("adhesionId");

CREATE UNIQUE INDEX backoffice_user_subscriptions_pkey ON public.backoffice_user_subscriptions USING btree (id);

CREATE INDEX "backoffice_user_subscriptions_productId_idx" ON public.backoffice_user_subscriptions USING btree ("productId");

CREATE INDEX "backoffice_user_subscriptions_profileId_status_idx" ON public.backoffice_user_subscriptions USING btree ("profileId", status);

CREATE UNIQUE INDEX backoffice_user_subscriptions_profile_id_product_id_key ON public.backoffice_user_subscriptions USING btree ("profileId", "productId");

CREATE INDEX backoffice_users_created_by_profile_id_idx ON public.backoffice_users USING btree ("createdByProfileId");

CREATE UNIQUE INDEX backoffice_users_email_key ON public.backoffice_users USING btree (email);

CREATE INDEX backoffice_users_google_connected_idx ON public.backoffice_users USING btree ("googleCalendarConnected");

CREATE INDEX backoffice_users_is_active_idx ON public.backoffice_users USING btree ("isActive");

CREATE INDEX backoffice_users_is_closer_idx ON public.backoffice_users USING btree ("isCloser");

CREATE INDEX backoffice_users_is_sdr_idx ON public.backoffice_users USING btree ("isSdr");

CREATE UNIQUE INDEX backoffice_users_pkey ON public.backoffice_users USING btree (id);

CREATE UNIQUE INDEX "backoffice_users_profileId_key" ON public.backoffice_users USING btree ("profileId");

CREATE UNIQUE INDEX backoffice_webhook_events_pkey ON public.backoffice_webhook_events USING btree (id);

CREATE INDEX backoffice_webhook_events_source_received_at_idx ON public.backoffice_webhook_events USING btree (source, "receivedAt" DESC);

CREATE INDEX backoffice_webhook_events_status_idx ON public.backoffice_webhook_events USING btree (status);

CREATE UNIQUE INDEX backoffice_webhook_request_logs_pkey ON public.backoffice_webhook_request_logs USING btree (id);

CREATE INDEX backoffice_webhook_request_logs_source_created_at_idx ON public.backoffice_webhook_request_logs USING btree (source, "createdAt" DESC);

CREATE INDEX backoffice_webhook_request_logs_status_code_idx ON public.backoffice_webhook_request_logs USING btree ("statusCode");

CREATE INDEX backoffice_webhook_tokens_expires_at_idx ON public.backoffice_webhook_tokens USING btree ("expiresAt");

CREATE INDEX backoffice_webhook_tokens_generated_at_idx ON public.backoffice_webhook_tokens USING btree ("generatedAt" DESC);

CREATE INDEX backoffice_webhook_tokens_generated_by_idx ON public.backoffice_webhook_tokens USING btree ("generatedByBackofficeUserId");

CREATE UNIQUE INDEX backoffice_webhook_tokens_pkey ON public.backoffice_webhook_tokens USING btree (id);

CREATE INDEX backoffice_webhook_tokens_source_status_idx ON public.backoffice_webhook_tokens USING btree (source, status);

CREATE INDEX "corretor_studio_email_campaigns_createdBy_idx" ON public.corretor_studio_email_campaigns USING btree ("createdBy");

CREATE UNIQUE INDEX corretor_studio_email_campaigns_pkey ON public.corretor_studio_email_campaigns USING btree (id);

CREATE INDEX "corretor_studio_email_campaigns_teamId_scheduledAt_idx" ON public.corretor_studio_email_campaigns USING btree ("teamId", "scheduledAt");

CREATE INDEX "corretor_studio_email_campaigns_teamId_status_idx" ON public.corretor_studio_email_campaigns USING btree ("teamId", status);

CREATE INDEX "corretor_studio_email_contact_lists_createdBy_idx" ON public.corretor_studio_email_contact_lists USING btree ("createdBy");

CREATE UNIQUE INDEX corretor_studio_email_contact_lists_pkey ON public.corretor_studio_email_contact_lists USING btree (id);

CREATE INDEX "corretor_studio_email_contact_lists_teamId_isArchived_idx" ON public.corretor_studio_email_contact_lists USING btree ("teamId", "isArchived");

CREATE UNIQUE INDEX "corretor_studio_email_contacts_listId_email_key" ON public.corretor_studio_email_contacts USING btree ("listId", email);

CREATE INDEX "corretor_studio_email_contacts_listId_isBounced_idx" ON public.corretor_studio_email_contacts USING btree ("listId", "isBounced");

CREATE INDEX "corretor_studio_email_contacts_listId_isUnsubscribed_idx" ON public.corretor_studio_email_contacts USING btree ("listId", "isUnsubscribed");

CREATE UNIQUE INDEX corretor_studio_email_contacts_pkey ON public.corretor_studio_email_contacts USING btree (id);

CREATE INDEX "corretor_studio_email_credit_subscriptions_currentPeriodEnd_idx" ON public.corretor_studio_email_credit_subscriptions USING btree ("currentPeriodEnd");

CREATE UNIQUE INDEX corretor_studio_email_credit_subscriptions_pkey ON public.corretor_studio_email_credit_subscriptions USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_email_credit_subscriptions_profileId_key" ON public.corretor_studio_email_credit_subscriptions USING btree ("profileId");

CREATE UNIQUE INDEX corretor_studio_email_credit_usages_pkey ON public.corretor_studio_email_credit_usages USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_email_credit_usages_subscriptionId_periodSt_key" ON public.corretor_studio_email_credit_usages USING btree ("subscriptionId", "periodStart");

CREATE INDEX "corretor_studio_email_events_logId_occurredAt_idx" ON public.corretor_studio_email_events USING btree ("logId", "occurredAt" DESC);

CREATE UNIQUE INDEX corretor_studio_email_events_pkey ON public.corretor_studio_email_events USING btree (id);

CREATE UNIQUE INDEX corretor_studio_email_logs_pkey ON public.corretor_studio_email_logs USING btree (id);

CREATE INDEX "corretor_studio_email_logs_recipientEmail_idx" ON public.corretor_studio_email_logs USING btree ("recipientEmail");

CREATE UNIQUE INDEX "corretor_studio_email_logs_resendEmailId_key" ON public.corretor_studio_email_logs USING btree ("resendEmailId");

CREATE INDEX "corretor_studio_email_logs_sentAt_idx" ON public.corretor_studio_email_logs USING btree ("sentAt" DESC);

CREATE INDEX "corretor_studio_email_logs_teamId_campaignId_idx" ON public.corretor_studio_email_logs USING btree ("teamId", "campaignId");

CREATE INDEX "corretor_studio_email_logs_teamId_status_idx" ON public.corretor_studio_email_logs USING btree ("teamId", status);

CREATE INDEX "corretor_studio_email_templates_createdBy_idx" ON public.corretor_studio_email_templates USING btree ("createdBy");

CREATE UNIQUE INDEX corretor_studio_email_templates_pkey ON public.corretor_studio_email_templates USING btree (id);

CREATE INDEX "corretor_studio_email_templates_teamId_isArchived_idx" ON public.corretor_studio_email_templates USING btree ("teamId", "isArchived");

CREATE INDEX "corretor_studio_health_plan_options_createdBy_idx" ON public.corretor_studio_health_plan_options USING btree ("createdBy");

CREATE INDEX corretor_studio_health_plan_options_name_idx ON public.corretor_studio_health_plan_options USING btree (name);

CREATE UNIQUE INDEX "corretor_studio_health_plan_options_normalizedName_key" ON public.corretor_studio_health_plan_options USING btree ("normalizedName");

CREATE UNIQUE INDEX corretor_studio_health_plan_options_pkey ON public.corretor_studio_health_plan_options USING btree (id);

CREATE INDEX "corretor_studio_lead_activities_createdBy_idx" ON public.corretor_studio_lead_activities USING btree ("createdBy");

CREATE INDEX "corretor_studio_lead_activities_leadId_idx" ON public.corretor_studio_lead_activities USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_lead_activities_pkey ON public.corretor_studio_lead_activities USING btree (id);

CREATE INDEX "corretor_studio_lead_activity_reactions_activityId_idx" ON public.corretor_studio_lead_activity_reactions USING btree ("activityId");

CREATE UNIQUE INDEX "corretor_studio_lead_activity_reactions_activityId_profileI_key" ON public.corretor_studio_lead_activity_reactions USING btree ("activityId", "profileId", "emojiUnified");

CREATE UNIQUE INDEX corretor_studio_lead_activity_reactions_pkey ON public.corretor_studio_lead_activity_reactions USING btree (id);

CREATE INDEX "corretor_studio_lead_activity_reactions_profileId_idx" ON public.corretor_studio_lead_activity_reactions USING btree ("profileId");

CREATE INDEX "corretor_studio_lead_attachments_leadId_idx" ON public.corretor_studio_lead_attachments USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_lead_attachments_pkey ON public.corretor_studio_lead_attachments USING btree (id);

CREATE INDEX "corretor_studio_lead_attachments_uploadedBy_idx" ON public.corretor_studio_lead_attachments USING btree ("uploadedBy");

CREATE INDEX "corretor_studio_lead_finalized_dependents_leadFinalizedId_idx" ON public.corretor_studio_lead_finalized_dependents USING btree ("leadFinalizedId");

CREATE UNIQUE INDEX corretor_studio_lead_finalized_dependents_pkey ON public.corretor_studio_lead_finalized_dependents USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_lead_finalized_holders_leadFinalizedId_key" ON public.corretor_studio_lead_finalized_holders USING btree ("leadFinalizedId");

CREATE UNIQUE INDEX corretor_studio_lead_finalized_holders_pkey ON public.corretor_studio_lead_finalized_holders USING btree (id);

CREATE INDEX "corretor_studio_lead_finalized_leadId_idx" ON public.corretor_studio_lead_finalized USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_lead_finalized_pkey ON public.corretor_studio_lead_finalized USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_lead_portfolio_leadId_key" ON public.corretor_studio_lead_portfolio USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_lead_portfolio_pkey ON public.corretor_studio_lead_portfolio USING btree (id);

CREATE INDEX "corretor_studio_lead_portfolio_teamId_idx" ON public.corretor_studio_lead_portfolio USING btree ("teamId");

CREATE INDEX "corretor_studio_lead_portfolio_teamId_portfolioStatus_idx" ON public.corretor_studio_lead_portfolio USING btree ("teamId", "portfolioStatus");

CREATE INDEX "corretor_studio_leads_assignedTo_idx" ON public.corretor_studio_leads USING btree ("assignedTo");

CREATE INDEX "corretor_studio_leads_closerId_idx" ON public.corretor_studio_leads USING btree ("closerId");

CREATE INDEX "corretor_studio_leads_createdBy_idx" ON public.corretor_studio_leads USING btree ("createdBy");

CREATE INDEX "corretor_studio_leads_followUpAt_idx" ON public.corretor_studio_leads USING btree ("followUpAt");

CREATE UNIQUE INDEX corretor_studio_leads_id_key ON public.corretor_studio_leads USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_leads_leadCode_key" ON public.corretor_studio_leads USING btree ("leadCode");

CREATE INDEX "corretor_studio_leads_meetingDate_idx" ON public.corretor_studio_leads USING btree ("meetingDate");

CREATE UNIQUE INDEX corretor_studio_leads_pkey ON public.corretor_studio_leads USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_leads_schedule_leadId_key" ON public.corretor_studio_leads_schedule USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_leads_schedule_pkey ON public.corretor_studio_leads_schedule USING btree (id);

CREATE INDEX "corretor_studio_leads_statusEnteredAt_idx" ON public.corretor_studio_leads USING btree ("statusEnteredAt");

CREATE UNIQUE INDEX "corretor_studio_leads_teamId_cnpj_key" ON public.corretor_studio_leads USING btree ("teamId", cnpj);

CREATE UNIQUE INDEX "corretor_studio_leads_teamId_email_key" ON public.corretor_studio_leads USING btree ("teamId", email);

CREATE INDEX "corretor_studio_leads_teamId_idx" ON public.corretor_studio_leads USING btree ("teamId");

CREATE INDEX "corretor_studio_leads_updatedBy_idx" ON public.corretor_studio_leads USING btree ("updatedBy");

CREATE UNIQUE INDEX corretor_studio_notifications_pkey ON public.corretor_studio_notifications USING btree (id);

CREATE INDEX "corretor_studio_notifications_recipientProfileId_createdAt_idx" ON public.corretor_studio_notifications USING btree ("recipientProfileId", "createdAt");

CREATE INDEX "corretor_studio_notifications_recipientProfileId_teamId_isR_idx" ON public.corretor_studio_notifications USING btree ("recipientProfileId", "teamId", "isRead");

CREATE INDEX "corretor_studio_notifications_teamId_createdAt_idx" ON public.corretor_studio_notifications USING btree ("teamId", "createdAt");

CREATE INDEX "corretor_studio_pending_actions_checkoutId_idx" ON public.corretor_studio_pending_actions USING btree ("checkoutId");

CREATE INDEX "corretor_studio_pending_actions_masterId_idx" ON public.corretor_studio_pending_actions USING btree ("masterId");

CREATE INDEX "corretor_studio_pending_actions_paymentId_idx" ON public.corretor_studio_pending_actions USING btree ("paymentId");

CREATE UNIQUE INDEX corretor_studio_pending_actions_pkey ON public.corretor_studio_pending_actions USING btree (id);

CREATE INDEX corretor_studio_pending_operators_email_idx ON public.corretor_studio_pending_operators USING btree (email);

CREATE INDEX "corretor_studio_pending_operators_managerId_idx" ON public.corretor_studio_pending_operators USING btree ("managerId");

CREATE UNIQUE INDEX "corretor_studio_pending_operators_paymentId_key" ON public.corretor_studio_pending_operators USING btree ("paymentId");

CREATE UNIQUE INDEX corretor_studio_pending_operators_pkey ON public.corretor_studio_pending_operators USING btree (id);

CREATE INDEX "corretor_studio_pending_operators_subscriptionId_idx" ON public.corretor_studio_pending_operators USING btree ("subscriptionId");

CREATE UNIQUE INDEX corretor_studio_profile_subscription_capacities_pkey ON public.corretor_studio_profile_subscription_capacities USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_profile_subscription_capacities_profileSubs_key" ON public.corretor_studio_profile_subscription_capacities USING btree ("profileSubscriptionId");

CREATE UNIQUE INDEX "corretor_studio_profile_subscriptions_adhesionId_key" ON public.corretor_studio_profile_subscriptions USING btree ("adhesionId");

CREATE UNIQUE INDEX corretor_studio_profile_subscriptions_pkey ON public.corretor_studio_profile_subscriptions USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_profile_subscriptions_profileId_key" ON public.corretor_studio_profile_subscriptions USING btree ("profileId");

CREATE INDEX "corretor_studio_profiles_cpfCnpj_idx" ON public.corretor_studio_profiles USING btree ("cpfCnpj");

CREATE UNIQUE INDEX corretor_studio_profiles_email_key ON public.corretor_studio_profiles USING btree (email);

CREATE UNIQUE INDEX corretor_studio_profiles_id_key ON public.corretor_studio_profiles USING btree (id);

CREATE INDEX "corretor_studio_profiles_managerId_idx" ON public.corretor_studio_profiles USING btree ("managerId");

CREATE UNIQUE INDEX corretor_studio_profiles_pkey ON public.corretor_studio_profiles USING btree (id);

CREATE INDEX corretor_studio_profiles_role_idx ON public.corretor_studio_profiles USING btree (role);

CREATE UNIQUE INDEX "corretor_studio_profiles_supabaseId_key" ON public.corretor_studio_profiles USING btree ("supabaseId");

CREATE UNIQUE INDEX corretor_studio_task_assignees_pkey ON public.corretor_studio_task_assignees USING btree (id);

CREATE INDEX "corretor_studio_task_assignees_profileId_idx" ON public.corretor_studio_task_assignees USING btree ("profileId");

CREATE INDEX corretor_studio_task_assignees_status_idx ON public.corretor_studio_task_assignees USING btree (status);

CREATE INDEX "corretor_studio_task_assignees_taskId_idx" ON public.corretor_studio_task_assignees USING btree ("taskId");

CREATE UNIQUE INDEX "corretor_studio_task_assignees_taskId_profileId_key" ON public.corretor_studio_task_assignees USING btree ("taskId", "profileId");

CREATE UNIQUE INDEX "corretor_studio_tasks_activityId_key" ON public.corretor_studio_tasks USING btree ("activityId");

CREATE INDEX "corretor_studio_tasks_createdBy_idx" ON public.corretor_studio_tasks USING btree ("createdBy");

CREATE INDEX "corretor_studio_tasks_endAt_idx" ON public.corretor_studio_tasks USING btree ("endAt");

CREATE INDEX "corretor_studio_tasks_leadId_idx" ON public.corretor_studio_tasks USING btree ("leadId");

CREATE UNIQUE INDEX corretor_studio_tasks_pkey ON public.corretor_studio_tasks USING btree (id);

CREATE INDEX "corretor_studio_tasks_startAt_idx" ON public.corretor_studio_tasks USING btree ("startAt");

CREATE UNIQUE INDEX corretor_studio_team_filter_presets_pkey ON public.corretor_studio_team_filter_presets USING btree (id);

CREATE INDEX "corretor_studio_team_filter_presets_teamId_createdBy_idx" ON public.corretor_studio_team_filter_presets USING btree ("teamId", "createdBy");

CREATE INDEX "corretor_studio_team_filter_presets_teamId_lastUsedAt_idx" ON public.corretor_studio_team_filter_presets USING btree ("teamId", "lastUsedAt" DESC);

CREATE UNIQUE INDEX corretor_studio_team_members_pkey ON public.corretor_studio_team_members USING btree (id);

CREATE INDEX "corretor_studio_team_members_profileId_idx" ON public.corretor_studio_team_members USING btree ("profileId");

CREATE UNIQUE INDEX "corretor_studio_team_members_teamId_profileId_key" ON public.corretor_studio_team_members USING btree ("teamId", "profileId");

CREATE UNIQUE INDEX corretor_studio_team_status_rules_pkey ON public.corretor_studio_team_status_rules USING btree (id);

CREATE INDEX "corretor_studio_team_status_rules_teamId_isEnabled_idx" ON public.corretor_studio_team_status_rules USING btree ("teamId", "isEnabled");

CREATE INDEX "corretor_studio_team_status_rules_teamId_type_targetStatus__idx" ON public.corretor_studio_team_status_rules USING btree ("teamId", type, "targetStatus", "isEnabled");

CREATE INDEX "corretor_studio_team_studio_webhook_configs_expiresAt_idx" ON public.corretor_studio_team_studio_webhook_configs USING btree ("expiresAt");

CREATE UNIQUE INDEX corretor_studio_team_studio_webhook_configs_pkey ON public.corretor_studio_team_studio_webhook_configs USING btree (id);

CREATE UNIQUE INDEX "corretor_studio_team_studio_webhook_configs_teamId_key" ON public.corretor_studio_team_studio_webhook_configs USING btree ("teamId");

CREATE INDEX "corretor_studio_team_studio_webhook_configs_updatedByProfil_idx" ON public.corretor_studio_team_studio_webhook_configs USING btree ("updatedByProfileId");

CREATE INDEX "corretor_studio_team_studio_webhook_request_logs_createdAt_idx" ON public.corretor_studio_team_studio_webhook_request_logs USING btree ("createdAt" DESC);

CREATE UNIQUE INDEX corretor_studio_team_studio_webhook_request_logs_pkey ON public.corretor_studio_team_studio_webhook_request_logs USING btree (id);

CREATE INDEX "corretor_studio_team_studio_webhook_request_logs_teamId_cre_idx" ON public.corretor_studio_team_studio_webhook_request_logs USING btree ("teamId", "createdAt" DESC);

CREATE INDEX "corretor_studio_teams_masterId_idx" ON public.corretor_studio_teams USING btree ("masterId");

CREATE UNIQUE INDEX corretor_studio_teams_pkey ON public.corretor_studio_teams USING btree (id);

CREATE INDEX profile_subscriptions_adhesion_id_idx ON public.corretor_studio_profile_subscriptions USING btree ("adhesionId");

CREATE INDEX profile_subscriptions_product_id_idx ON public.corretor_studio_profile_subscriptions USING btree ("productId");

CREATE INDEX profile_subscriptions_status_idx ON public.corretor_studio_profile_subscriptions USING btree ("subscriptionStatus");

alter table "public"."backoffice_adhesions" add constraint "backoffice_adhesions_pkey" PRIMARY KEY using index "backoffice_adhesions_pkey";

alter table "public"."backoffice_clients" add constraint "backoffice_clients_pkey" PRIMARY KEY using index "backoffice_clients_pkey";

alter table "public"."backoffice_feature_access_rules" add constraint "backoffice_feature_access_rules_pkey" PRIMARY KEY using index "backoffice_feature_access_rules_pkey";

alter table "public"."backoffice_feature_grants" add constraint "backoffice_feature_grants_pkey" PRIMARY KEY using index "backoffice_feature_grants_pkey";

alter table "public"."backoffice_features" add constraint "backoffice_features_pkey" PRIMARY KEY using index "backoffice_features_pkey";

alter table "public"."backoffice_leads" add constraint "backoffice_leads_pkey" PRIMARY KEY using index "backoffice_leads_pkey";

alter table "public"."backoffice_leads_schedule" add constraint "backoffice_leads_schedule_pkey" PRIMARY KEY using index "backoffice_leads_schedule_pkey";

alter table "public"."backoffice_payments" add constraint "backoffice_payments_pkey" PRIMARY KEY using index "backoffice_payments_pkey";

alter table "public"."backoffice_product_payment_rules" add constraint "backoffice_product_payment_rules_pkey" PRIMARY KEY using index "backoffice_product_payment_rules_pkey";

alter table "public"."backoffice_products" add constraint "backoffice_products_pkey" PRIMARY KEY using index "backoffice_products_pkey";

alter table "public"."backoffice_user_subscriptions" add constraint "backoffice_user_subscriptions_pkey" PRIMARY KEY using index "backoffice_user_subscriptions_pkey";

alter table "public"."backoffice_users" add constraint "backoffice_users_pkey" PRIMARY KEY using index "backoffice_users_pkey";

alter table "public"."backoffice_webhook_events" add constraint "backoffice_webhook_events_pkey" PRIMARY KEY using index "backoffice_webhook_events_pkey";

alter table "public"."backoffice_webhook_request_logs" add constraint "backoffice_webhook_request_logs_pkey" PRIMARY KEY using index "backoffice_webhook_request_logs_pkey";

alter table "public"."backoffice_webhook_tokens" add constraint "backoffice_webhook_tokens_pkey" PRIMARY KEY using index "backoffice_webhook_tokens_pkey";

alter table "public"."corretor_studio_email_campaigns" add constraint "corretor_studio_email_campaigns_pkey" PRIMARY KEY using index "corretor_studio_email_campaigns_pkey";

alter table "public"."corretor_studio_email_contact_lists" add constraint "corretor_studio_email_contact_lists_pkey" PRIMARY KEY using index "corretor_studio_email_contact_lists_pkey";

alter table "public"."corretor_studio_email_contacts" add constraint "corretor_studio_email_contacts_pkey" PRIMARY KEY using index "corretor_studio_email_contacts_pkey";

alter table "public"."corretor_studio_email_credit_subscriptions" add constraint "corretor_studio_email_credit_subscriptions_pkey" PRIMARY KEY using index "corretor_studio_email_credit_subscriptions_pkey";

alter table "public"."corretor_studio_email_credit_usages" add constraint "corretor_studio_email_credit_usages_pkey" PRIMARY KEY using index "corretor_studio_email_credit_usages_pkey";

alter table "public"."corretor_studio_email_events" add constraint "corretor_studio_email_events_pkey" PRIMARY KEY using index "corretor_studio_email_events_pkey";

alter table "public"."corretor_studio_email_logs" add constraint "corretor_studio_email_logs_pkey" PRIMARY KEY using index "corretor_studio_email_logs_pkey";

alter table "public"."corretor_studio_email_templates" add constraint "corretor_studio_email_templates_pkey" PRIMARY KEY using index "corretor_studio_email_templates_pkey";

alter table "public"."corretor_studio_health_plan_options" add constraint "corretor_studio_health_plan_options_pkey" PRIMARY KEY using index "corretor_studio_health_plan_options_pkey";

alter table "public"."corretor_studio_lead_activities" add constraint "corretor_studio_lead_activities_pkey" PRIMARY KEY using index "corretor_studio_lead_activities_pkey";

alter table "public"."corretor_studio_lead_activity_reactions" add constraint "corretor_studio_lead_activity_reactions_pkey" PRIMARY KEY using index "corretor_studio_lead_activity_reactions_pkey";

alter table "public"."corretor_studio_lead_attachments" add constraint "corretor_studio_lead_attachments_pkey" PRIMARY KEY using index "corretor_studio_lead_attachments_pkey";

alter table "public"."corretor_studio_lead_finalized" add constraint "corretor_studio_lead_finalized_pkey" PRIMARY KEY using index "corretor_studio_lead_finalized_pkey";

alter table "public"."corretor_studio_lead_finalized_dependents" add constraint "corretor_studio_lead_finalized_dependents_pkey" PRIMARY KEY using index "corretor_studio_lead_finalized_dependents_pkey";

alter table "public"."corretor_studio_lead_finalized_holders" add constraint "corretor_studio_lead_finalized_holders_pkey" PRIMARY KEY using index "corretor_studio_lead_finalized_holders_pkey";

alter table "public"."corretor_studio_lead_portfolio" add constraint "corretor_studio_lead_portfolio_pkey" PRIMARY KEY using index "corretor_studio_lead_portfolio_pkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_pkey" PRIMARY KEY using index "corretor_studio_leads_pkey";

alter table "public"."corretor_studio_leads_schedule" add constraint "corretor_studio_leads_schedule_pkey" PRIMARY KEY using index "corretor_studio_leads_schedule_pkey";

alter table "public"."corretor_studio_notifications" add constraint "corretor_studio_notifications_pkey" PRIMARY KEY using index "corretor_studio_notifications_pkey";

alter table "public"."corretor_studio_pending_actions" add constraint "corretor_studio_pending_actions_pkey" PRIMARY KEY using index "corretor_studio_pending_actions_pkey";

alter table "public"."corretor_studio_pending_operators" add constraint "corretor_studio_pending_operators_pkey" PRIMARY KEY using index "corretor_studio_pending_operators_pkey";

alter table "public"."corretor_studio_profile_subscription_capacities" add constraint "corretor_studio_profile_subscription_capacities_pkey" PRIMARY KEY using index "corretor_studio_profile_subscription_capacities_pkey";

alter table "public"."corretor_studio_profile_subscriptions" add constraint "corretor_studio_profile_subscriptions_pkey" PRIMARY KEY using index "corretor_studio_profile_subscriptions_pkey";

alter table "public"."corretor_studio_profiles" add constraint "corretor_studio_profiles_pkey" PRIMARY KEY using index "corretor_studio_profiles_pkey";

alter table "public"."corretor_studio_task_assignees" add constraint "corretor_studio_task_assignees_pkey" PRIMARY KEY using index "corretor_studio_task_assignees_pkey";

alter table "public"."corretor_studio_tasks" add constraint "corretor_studio_tasks_pkey" PRIMARY KEY using index "corretor_studio_tasks_pkey";

alter table "public"."corretor_studio_team_filter_presets" add constraint "corretor_studio_team_filter_presets_pkey" PRIMARY KEY using index "corretor_studio_team_filter_presets_pkey";

alter table "public"."corretor_studio_team_members" add constraint "corretor_studio_team_members_pkey" PRIMARY KEY using index "corretor_studio_team_members_pkey";

alter table "public"."corretor_studio_team_status_rules" add constraint "corretor_studio_team_status_rules_pkey" PRIMARY KEY using index "corretor_studio_team_status_rules_pkey";

alter table "public"."corretor_studio_team_studio_webhook_configs" add constraint "corretor_studio_team_studio_webhook_configs_pkey" PRIMARY KEY using index "corretor_studio_team_studio_webhook_configs_pkey";

alter table "public"."corretor_studio_team_studio_webhook_request_logs" add constraint "corretor_studio_team_studio_webhook_request_logs_pkey" PRIMARY KEY using index "corretor_studio_team_studio_webhook_request_logs_pkey";

alter table "public"."corretor_studio_teams" add constraint "corretor_studio_teams_pkey" PRIMARY KEY using index "corretor_studio_teams_pkey";

alter table "public"."backoffice_adhesions" add constraint "backoffice_adhesions_closerBackofficeUserId_fkey" FOREIGN KEY ("closerBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_adhesions" validate constraint "backoffice_adhesions_closerBackofficeUserId_fkey";

alter table "public"."backoffice_adhesions" add constraint "backoffice_adhesions_createdByBackofficeUserId_fkey" FOREIGN KEY ("createdByBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_adhesions" validate constraint "backoffice_adhesions_createdByBackofficeUserId_fkey";

alter table "public"."backoffice_adhesions" add constraint "backoffice_adhesions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.backoffice_leads(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_adhesions" validate constraint "backoffice_adhesions_leadId_fkey";

alter table "public"."backoffice_adhesions" add constraint "backoffice_adhesions_sdrBackofficeUserId_fkey" FOREIGN KEY ("sdrBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_adhesions" validate constraint "backoffice_adhesions_sdrBackofficeUserId_fkey";

alter table "public"."backoffice_clients" add constraint "backoffice_clients_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_clients" validate constraint "backoffice_clients_createdByProfileId_fkey";

alter table "public"."backoffice_feature_access_rules" add constraint "backoffice_feature_access_rules_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES public.backoffice_features(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_feature_access_rules" validate constraint "backoffice_feature_access_rules_featureId_fkey";

alter table "public"."backoffice_feature_grants" add constraint "backoffice_feature_grants_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES public.backoffice_features(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_feature_grants" validate constraint "backoffice_feature_grants_featureId_fkey";

alter table "public"."backoffice_feature_grants" add constraint "backoffice_feature_grants_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_feature_grants" validate constraint "backoffice_feature_grants_profileId_fkey";

alter table "public"."backoffice_features" add constraint "backoffice_features_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.backoffice_features(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_features" validate constraint "backoffice_features_parentId_fkey";

alter table "public"."backoffice_features" add constraint "backoffice_features_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES public.backoffice_products(slug) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_features" validate constraint "backoffice_features_productSlug_fkey";

alter table "public"."backoffice_leads" add constraint "backoffice_leads_closer_backoffice_user_id_fkey" FOREIGN KEY ("closerBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_leads" validate constraint "backoffice_leads_closer_backoffice_user_id_fkey";

alter table "public"."backoffice_leads" add constraint "backoffice_leads_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_leads" validate constraint "backoffice_leads_createdByProfileId_fkey";

alter table "public"."backoffice_leads" add constraint "backoffice_leads_sdr_backoffice_user_id_fkey" FOREIGN KEY ("sdrBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_leads" validate constraint "backoffice_leads_sdr_backoffice_user_id_fkey";

alter table "public"."backoffice_leads" add constraint "backoffice_leads_source_webhook_event_id_fkey" FOREIGN KEY ("sourceWebhookEventId") REFERENCES public.backoffice_webhook_events(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_leads" validate constraint "backoffice_leads_source_webhook_event_id_fkey";

alter table "public"."backoffice_leads_schedule" add constraint "backoffice_leads_schedule_closer_backoffice_user_id_fkey" FOREIGN KEY ("closerBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_leads_schedule" validate constraint "backoffice_leads_schedule_closer_backoffice_user_id_fkey";

alter table "public"."backoffice_leads_schedule" add constraint "backoffice_leads_schedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.backoffice_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_leads_schedule" validate constraint "backoffice_leads_schedule_leadId_fkey";

alter table "public"."backoffice_payments" add constraint "backoffice_payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.backoffice_clients(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_payments" validate constraint "backoffice_payments_clientId_fkey";

alter table "public"."backoffice_payments" add constraint "backoffice_payments_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_payments" validate constraint "backoffice_payments_createdByProfileId_fkey";

alter table "public"."backoffice_product_payment_rules" add constraint "backoffice_product_payment_rules_productid_fkey" FOREIGN KEY ("productId") REFERENCES public.backoffice_products(id) ON DELETE CASCADE not valid;

alter table "public"."backoffice_product_payment_rules" validate constraint "backoffice_product_payment_rules_productid_fkey";

alter table "public"."backoffice_user_subscriptions" add constraint "backoffice_user_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.backoffice_products(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_user_subscriptions" validate constraint "backoffice_user_subscriptions_productId_fkey";

alter table "public"."backoffice_user_subscriptions" add constraint "backoffice_user_subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_user_subscriptions" validate constraint "backoffice_user_subscriptions_profileId_fkey";

alter table "public"."backoffice_users" add constraint "backoffice_users_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_users" validate constraint "backoffice_users_createdByProfileId_fkey";

alter table "public"."backoffice_users" add constraint "backoffice_users_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."backoffice_users" validate constraint "backoffice_users_profileId_fkey";

alter table "public"."backoffice_webhook_tokens" add constraint "backoffice_webhook_tokens_generatedByBackofficeUserId_fkey" FOREIGN KEY ("generatedByBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_webhook_tokens" validate constraint "backoffice_webhook_tokens_generatedByBackofficeUserId_fkey";

alter table "public"."corretor_studio_email_campaigns" add constraint "corretor_studio_email_campaigns_contactListId_fkey" FOREIGN KEY ("contactListId") REFERENCES public.corretor_studio_email_contact_lists(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_email_campaigns" validate constraint "corretor_studio_email_campaigns_contactListId_fkey";

alter table "public"."corretor_studio_email_campaigns" add constraint "corretor_studio_email_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_email_campaigns" validate constraint "corretor_studio_email_campaigns_createdBy_fkey";

alter table "public"."corretor_studio_email_campaigns" add constraint "corretor_studio_email_campaigns_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_campaigns" validate constraint "corretor_studio_email_campaigns_teamId_fkey";

alter table "public"."corretor_studio_email_campaigns" add constraint "corretor_studio_email_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.corretor_studio_email_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_email_campaigns" validate constraint "corretor_studio_email_campaigns_templateId_fkey";

alter table "public"."corretor_studio_email_contact_lists" add constraint "corretor_studio_email_contact_lists_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_email_contact_lists" validate constraint "corretor_studio_email_contact_lists_createdBy_fkey";

alter table "public"."corretor_studio_email_contact_lists" add constraint "corretor_studio_email_contact_lists_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_contact_lists" validate constraint "corretor_studio_email_contact_lists_teamId_fkey";

alter table "public"."corretor_studio_email_contacts" add constraint "corretor_studio_email_contacts_listId_fkey" FOREIGN KEY ("listId") REFERENCES public.corretor_studio_email_contact_lists(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_contacts" validate constraint "corretor_studio_email_contacts_listId_fkey";

alter table "public"."corretor_studio_email_credit_subscriptions" add constraint "corretor_studio_email_credit_subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_credit_subscriptions" validate constraint "corretor_studio_email_credit_subscriptions_profileId_fkey";

alter table "public"."corretor_studio_email_credit_usages" add constraint "corretor_studio_email_credit_usages_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.corretor_studio_email_credit_subscriptions(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_credit_usages" validate constraint "corretor_studio_email_credit_usages_subscriptionId_fkey";

alter table "public"."corretor_studio_email_events" add constraint "corretor_studio_email_events_logId_fkey" FOREIGN KEY ("logId") REFERENCES public.corretor_studio_email_logs(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_events" validate constraint "corretor_studio_email_events_logId_fkey";

alter table "public"."corretor_studio_email_logs" add constraint "corretor_studio_email_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public.corretor_studio_email_campaigns(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_email_logs" validate constraint "corretor_studio_email_logs_campaignId_fkey";

alter table "public"."corretor_studio_email_logs" add constraint "corretor_studio_email_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_logs" validate constraint "corretor_studio_email_logs_teamId_fkey";

alter table "public"."corretor_studio_email_templates" add constraint "corretor_studio_email_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_email_templates" validate constraint "corretor_studio_email_templates_createdBy_fkey";

alter table "public"."corretor_studio_email_templates" add constraint "corretor_studio_email_templates_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_email_templates" validate constraint "corretor_studio_email_templates_teamId_fkey";

alter table "public"."corretor_studio_health_plan_options" add constraint "corretor_studio_health_plan_options_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_health_plan_options" validate constraint "corretor_studio_health_plan_options_createdBy_fkey";

alter table "public"."corretor_studio_lead_activities" add constraint "corretor_studio_lead_activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_lead_activities" validate constraint "corretor_studio_lead_activities_createdBy_fkey";

alter table "public"."corretor_studio_lead_activities" add constraint "corretor_studio_lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_activities" validate constraint "corretor_studio_lead_activities_leadId_fkey";

alter table "public"."corretor_studio_lead_activity_reactions" add constraint "corretor_studio_lead_activity_reactions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public.corretor_studio_lead_activities(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_activity_reactions" validate constraint "corretor_studio_lead_activity_reactions_activityId_fkey";

alter table "public"."corretor_studio_lead_activity_reactions" add constraint "corretor_studio_lead_activity_reactions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_activity_reactions" validate constraint "corretor_studio_lead_activity_reactions_profileId_fkey";

alter table "public"."corretor_studio_lead_attachments" add constraint "corretor_studio_lead_attachments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_attachments" validate constraint "corretor_studio_lead_attachments_leadId_fkey";

alter table "public"."corretor_studio_lead_attachments" add constraint "corretor_studio_lead_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_lead_attachments" validate constraint "corretor_studio_lead_attachments_uploadedBy_fkey";

alter table "public"."corretor_studio_lead_finalized" add constraint "corretor_studio_lead_finalized_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_lead_finalized" validate constraint "corretor_studio_lead_finalized_closerId_fkey";

alter table "public"."corretor_studio_lead_finalized" add constraint "corretor_studio_lead_finalized_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_finalized" validate constraint "corretor_studio_lead_finalized_leadId_fkey";

alter table "public"."corretor_studio_lead_finalized_dependents" add constraint "corretor_studio_lead_finalized_dependents_leadFinalizedId_fkey" FOREIGN KEY ("leadFinalizedId") REFERENCES public.corretor_studio_lead_finalized(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_finalized_dependents" validate constraint "corretor_studio_lead_finalized_dependents_leadFinalizedId_fkey";

alter table "public"."corretor_studio_lead_finalized_holders" add constraint "corretor_studio_lead_finalized_holders_leadFinalizedId_fkey" FOREIGN KEY ("leadFinalizedId") REFERENCES public.corretor_studio_lead_finalized(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_finalized_holders" validate constraint "corretor_studio_lead_finalized_holders_leadFinalizedId_fkey";

alter table "public"."corretor_studio_lead_portfolio" add constraint "corretor_studio_lead_portfolio_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_portfolio" validate constraint "corretor_studio_lead_portfolio_leadId_fkey";

alter table "public"."corretor_studio_lead_portfolio" add constraint "corretor_studio_lead_portfolio_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_lead_portfolio" validate constraint "corretor_studio_lead_portfolio_teamId_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_assignedTo_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_closerId_fkey" FOREIGN KEY ("closerId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_closerId_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_createdBy_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_managerId_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_teamId_fkey";

alter table "public"."corretor_studio_leads" add constraint "corretor_studio_leads_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_leads" validate constraint "corretor_studio_leads_updatedBy_fkey";

alter table "public"."corretor_studio_leads_schedule" add constraint "corretor_studio_leads_schedule_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_leads_schedule" validate constraint "corretor_studio_leads_schedule_leadId_fkey";

alter table "public"."corretor_studio_notifications" add constraint "corretor_studio_notifications_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_notifications" validate constraint "corretor_studio_notifications_actorProfileId_fkey";

alter table "public"."corretor_studio_notifications" add constraint "corretor_studio_notifications_recipientProfileId_fkey" FOREIGN KEY ("recipientProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_notifications" validate constraint "corretor_studio_notifications_recipientProfileId_fkey";

alter table "public"."corretor_studio_notifications" add constraint "corretor_studio_notifications_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_notifications" validate constraint "corretor_studio_notifications_teamId_fkey";

alter table "public"."corretor_studio_pending_actions" add constraint "corretor_studio_pending_actions_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_pending_actions" validate constraint "corretor_studio_pending_actions_masterId_fkey";

alter table "public"."corretor_studio_pending_actions" add constraint "corretor_studio_pending_actions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_pending_actions" validate constraint "corretor_studio_pending_actions_teamId_fkey";

alter table "public"."corretor_studio_pending_operators" add constraint "corretor_studio_pending_operators_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_pending_operators" validate constraint "corretor_studio_pending_operators_managerId_fkey";

alter table "public"."corretor_studio_pending_operators" add constraint "corretor_studio_pending_operators_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_pending_operators" validate constraint "corretor_studio_pending_operators_teamId_fkey";

alter table "public"."corretor_studio_profile_subscription_capacities" add constraint "profile_subscription_capacities_subscription_id_fkey" FOREIGN KEY ("profileSubscriptionId") REFERENCES public.corretor_studio_profile_subscriptions(id) ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_profile_subscription_capacities" validate constraint "profile_subscription_capacities_subscription_id_fkey";

alter table "public"."corretor_studio_profile_subscriptions" add constraint "profile_subscriptions_adhesionId_fkey" FOREIGN KEY ("adhesionId") REFERENCES public.backoffice_adhesions(id) ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_profile_subscriptions" validate constraint "profile_subscriptions_adhesionId_fkey";

alter table "public"."corretor_studio_profile_subscriptions" add constraint "profile_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.backoffice_products(id) ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_profile_subscriptions" validate constraint "profile_subscriptions_productId_fkey";

alter table "public"."corretor_studio_profile_subscriptions" add constraint "profile_subscriptions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_profile_subscriptions" validate constraint "profile_subscriptions_profileId_fkey";

alter table "public"."corretor_studio_profiles" add constraint "corretor_studio_profiles_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_profiles" validate constraint "corretor_studio_profiles_managerId_fkey";

alter table "public"."corretor_studio_task_assignees" add constraint "corretor_studio_task_assignees_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_task_assignees" validate constraint "corretor_studio_task_assignees_profileId_fkey";

alter table "public"."corretor_studio_task_assignees" add constraint "corretor_studio_task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public.corretor_studio_tasks(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_task_assignees" validate constraint "corretor_studio_task_assignees_taskId_fkey";

alter table "public"."corretor_studio_tasks" add constraint "corretor_studio_tasks_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public.corretor_studio_lead_activities(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."corretor_studio_tasks" validate constraint "corretor_studio_tasks_activityId_fkey";

alter table "public"."corretor_studio_tasks" add constraint "corretor_studio_tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_tasks" validate constraint "corretor_studio_tasks_createdBy_fkey";

alter table "public"."corretor_studio_tasks" add constraint "corretor_studio_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.corretor_studio_leads(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_tasks" validate constraint "corretor_studio_tasks_leadId_fkey";

alter table "public"."corretor_studio_team_filter_presets" add constraint "corretor_studio_team_filter_presets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_filter_presets" validate constraint "corretor_studio_team_filter_presets_createdBy_fkey";

alter table "public"."corretor_studio_team_filter_presets" add constraint "corretor_studio_team_filter_presets_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_filter_presets" validate constraint "corretor_studio_team_filter_presets_teamId_fkey";

alter table "public"."corretor_studio_team_members" add constraint "corretor_studio_team_members_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_members" validate constraint "corretor_studio_team_members_profileId_fkey";

alter table "public"."corretor_studio_team_members" add constraint "corretor_studio_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_members" validate constraint "corretor_studio_team_members_teamId_fkey";

alter table "public"."corretor_studio_team_status_rules" add constraint "corretor_studio_team_status_rules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_status_rules" validate constraint "corretor_studio_team_status_rules_createdBy_fkey";

alter table "public"."corretor_studio_team_status_rules" add constraint "corretor_studio_team_status_rules_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_status_rules" validate constraint "corretor_studio_team_status_rules_teamId_fkey";

alter table "public"."corretor_studio_team_studio_webhook_configs" add constraint "corretor_studio_team_studio_webhook_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_studio_webhook_configs" validate constraint "corretor_studio_team_studio_webhook_configs_teamId_fkey";

alter table "public"."corretor_studio_team_studio_webhook_configs" add constraint "corretor_studio_team_studio_webhook_configs_updatedByProfi_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."corretor_studio_team_studio_webhook_configs" validate constraint "corretor_studio_team_studio_webhook_configs_updatedByProfi_fkey";

alter table "public"."corretor_studio_team_studio_webhook_request_logs" add constraint "corretor_studio_team_studio_webhook_request_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_team_studio_webhook_request_logs" validate constraint "corretor_studio_team_studio_webhook_request_logs_teamId_fkey";

alter table "public"."corretor_studio_teams" add constraint "corretor_studio_teams_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."corretor_studio_teams" validate constraint "corretor_studio_teams_masterId_fkey";

grant delete on table "public"."backoffice_adhesions" to "anon";

grant insert on table "public"."backoffice_adhesions" to "anon";

grant references on table "public"."backoffice_adhesions" to "anon";

grant select on table "public"."backoffice_adhesions" to "anon";

grant trigger on table "public"."backoffice_adhesions" to "anon";

grant truncate on table "public"."backoffice_adhesions" to "anon";

grant update on table "public"."backoffice_adhesions" to "anon";

grant delete on table "public"."backoffice_adhesions" to "authenticated";

grant insert on table "public"."backoffice_adhesions" to "authenticated";

grant references on table "public"."backoffice_adhesions" to "authenticated";

grant select on table "public"."backoffice_adhesions" to "authenticated";

grant trigger on table "public"."backoffice_adhesions" to "authenticated";

grant truncate on table "public"."backoffice_adhesions" to "authenticated";

grant update on table "public"."backoffice_adhesions" to "authenticated";

grant delete on table "public"."backoffice_adhesions" to "service_role";

grant insert on table "public"."backoffice_adhesions" to "service_role";

grant references on table "public"."backoffice_adhesions" to "service_role";

grant select on table "public"."backoffice_adhesions" to "service_role";

grant trigger on table "public"."backoffice_adhesions" to "service_role";

grant truncate on table "public"."backoffice_adhesions" to "service_role";

grant update on table "public"."backoffice_adhesions" to "service_role";

grant delete on table "public"."backoffice_clients" to "anon";

grant insert on table "public"."backoffice_clients" to "anon";

grant references on table "public"."backoffice_clients" to "anon";

grant select on table "public"."backoffice_clients" to "anon";

grant trigger on table "public"."backoffice_clients" to "anon";

grant truncate on table "public"."backoffice_clients" to "anon";

grant update on table "public"."backoffice_clients" to "anon";

grant delete on table "public"."backoffice_clients" to "authenticated";

grant insert on table "public"."backoffice_clients" to "authenticated";

grant references on table "public"."backoffice_clients" to "authenticated";

grant select on table "public"."backoffice_clients" to "authenticated";

grant trigger on table "public"."backoffice_clients" to "authenticated";

grant truncate on table "public"."backoffice_clients" to "authenticated";

grant update on table "public"."backoffice_clients" to "authenticated";

grant delete on table "public"."backoffice_clients" to "service_role";

grant insert on table "public"."backoffice_clients" to "service_role";

grant references on table "public"."backoffice_clients" to "service_role";

grant select on table "public"."backoffice_clients" to "service_role";

grant trigger on table "public"."backoffice_clients" to "service_role";

grant truncate on table "public"."backoffice_clients" to "service_role";

grant update on table "public"."backoffice_clients" to "service_role";

grant delete on table "public"."backoffice_feature_access_rules" to "anon";

grant insert on table "public"."backoffice_feature_access_rules" to "anon";

grant references on table "public"."backoffice_feature_access_rules" to "anon";

grant select on table "public"."backoffice_feature_access_rules" to "anon";

grant trigger on table "public"."backoffice_feature_access_rules" to "anon";

grant truncate on table "public"."backoffice_feature_access_rules" to "anon";

grant update on table "public"."backoffice_feature_access_rules" to "anon";

grant delete on table "public"."backoffice_feature_access_rules" to "authenticated";

grant insert on table "public"."backoffice_feature_access_rules" to "authenticated";

grant references on table "public"."backoffice_feature_access_rules" to "authenticated";

grant select on table "public"."backoffice_feature_access_rules" to "authenticated";

grant trigger on table "public"."backoffice_feature_access_rules" to "authenticated";

grant truncate on table "public"."backoffice_feature_access_rules" to "authenticated";

grant update on table "public"."backoffice_feature_access_rules" to "authenticated";

grant delete on table "public"."backoffice_feature_access_rules" to "service_role";

grant insert on table "public"."backoffice_feature_access_rules" to "service_role";

grant references on table "public"."backoffice_feature_access_rules" to "service_role";

grant select on table "public"."backoffice_feature_access_rules" to "service_role";

grant trigger on table "public"."backoffice_feature_access_rules" to "service_role";

grant truncate on table "public"."backoffice_feature_access_rules" to "service_role";

grant update on table "public"."backoffice_feature_access_rules" to "service_role";

grant delete on table "public"."backoffice_feature_grants" to "anon";

grant insert on table "public"."backoffice_feature_grants" to "anon";

grant references on table "public"."backoffice_feature_grants" to "anon";

grant select on table "public"."backoffice_feature_grants" to "anon";

grant trigger on table "public"."backoffice_feature_grants" to "anon";

grant truncate on table "public"."backoffice_feature_grants" to "anon";

grant update on table "public"."backoffice_feature_grants" to "anon";

grant delete on table "public"."backoffice_feature_grants" to "authenticated";

grant insert on table "public"."backoffice_feature_grants" to "authenticated";

grant references on table "public"."backoffice_feature_grants" to "authenticated";

grant select on table "public"."backoffice_feature_grants" to "authenticated";

grant trigger on table "public"."backoffice_feature_grants" to "authenticated";

grant truncate on table "public"."backoffice_feature_grants" to "authenticated";

grant update on table "public"."backoffice_feature_grants" to "authenticated";

grant delete on table "public"."backoffice_feature_grants" to "service_role";

grant insert on table "public"."backoffice_feature_grants" to "service_role";

grant references on table "public"."backoffice_feature_grants" to "service_role";

grant select on table "public"."backoffice_feature_grants" to "service_role";

grant trigger on table "public"."backoffice_feature_grants" to "service_role";

grant truncate on table "public"."backoffice_feature_grants" to "service_role";

grant update on table "public"."backoffice_feature_grants" to "service_role";

grant delete on table "public"."backoffice_features" to "anon";

grant insert on table "public"."backoffice_features" to "anon";

grant references on table "public"."backoffice_features" to "anon";

grant select on table "public"."backoffice_features" to "anon";

grant trigger on table "public"."backoffice_features" to "anon";

grant truncate on table "public"."backoffice_features" to "anon";

grant update on table "public"."backoffice_features" to "anon";

grant delete on table "public"."backoffice_features" to "authenticated";

grant insert on table "public"."backoffice_features" to "authenticated";

grant references on table "public"."backoffice_features" to "authenticated";

grant select on table "public"."backoffice_features" to "authenticated";

grant trigger on table "public"."backoffice_features" to "authenticated";

grant truncate on table "public"."backoffice_features" to "authenticated";

grant update on table "public"."backoffice_features" to "authenticated";

grant delete on table "public"."backoffice_features" to "service_role";

grant insert on table "public"."backoffice_features" to "service_role";

grant references on table "public"."backoffice_features" to "service_role";

grant select on table "public"."backoffice_features" to "service_role";

grant trigger on table "public"."backoffice_features" to "service_role";

grant truncate on table "public"."backoffice_features" to "service_role";

grant update on table "public"."backoffice_features" to "service_role";

grant delete on table "public"."backoffice_leads" to "anon";

grant insert on table "public"."backoffice_leads" to "anon";

grant references on table "public"."backoffice_leads" to "anon";

grant select on table "public"."backoffice_leads" to "anon";

grant trigger on table "public"."backoffice_leads" to "anon";

grant truncate on table "public"."backoffice_leads" to "anon";

grant update on table "public"."backoffice_leads" to "anon";

grant delete on table "public"."backoffice_leads" to "authenticated";

grant insert on table "public"."backoffice_leads" to "authenticated";

grant references on table "public"."backoffice_leads" to "authenticated";

grant select on table "public"."backoffice_leads" to "authenticated";

grant trigger on table "public"."backoffice_leads" to "authenticated";

grant truncate on table "public"."backoffice_leads" to "authenticated";

grant update on table "public"."backoffice_leads" to "authenticated";

grant delete on table "public"."backoffice_leads" to "service_role";

grant insert on table "public"."backoffice_leads" to "service_role";

grant references on table "public"."backoffice_leads" to "service_role";

grant select on table "public"."backoffice_leads" to "service_role";

grant trigger on table "public"."backoffice_leads" to "service_role";

grant truncate on table "public"."backoffice_leads" to "service_role";

grant update on table "public"."backoffice_leads" to "service_role";

grant delete on table "public"."backoffice_leads_schedule" to "anon";

grant insert on table "public"."backoffice_leads_schedule" to "anon";

grant references on table "public"."backoffice_leads_schedule" to "anon";

grant select on table "public"."backoffice_leads_schedule" to "anon";

grant trigger on table "public"."backoffice_leads_schedule" to "anon";

grant truncate on table "public"."backoffice_leads_schedule" to "anon";

grant update on table "public"."backoffice_leads_schedule" to "anon";

grant delete on table "public"."backoffice_leads_schedule" to "authenticated";

grant insert on table "public"."backoffice_leads_schedule" to "authenticated";

grant references on table "public"."backoffice_leads_schedule" to "authenticated";

grant select on table "public"."backoffice_leads_schedule" to "authenticated";

grant trigger on table "public"."backoffice_leads_schedule" to "authenticated";

grant truncate on table "public"."backoffice_leads_schedule" to "authenticated";

grant update on table "public"."backoffice_leads_schedule" to "authenticated";

grant delete on table "public"."backoffice_leads_schedule" to "service_role";

grant insert on table "public"."backoffice_leads_schedule" to "service_role";

grant references on table "public"."backoffice_leads_schedule" to "service_role";

grant select on table "public"."backoffice_leads_schedule" to "service_role";

grant trigger on table "public"."backoffice_leads_schedule" to "service_role";

grant truncate on table "public"."backoffice_leads_schedule" to "service_role";

grant update on table "public"."backoffice_leads_schedule" to "service_role";

grant delete on table "public"."backoffice_payments" to "anon";

grant insert on table "public"."backoffice_payments" to "anon";

grant references on table "public"."backoffice_payments" to "anon";

grant select on table "public"."backoffice_payments" to "anon";

grant trigger on table "public"."backoffice_payments" to "anon";

grant truncate on table "public"."backoffice_payments" to "anon";

grant update on table "public"."backoffice_payments" to "anon";

grant delete on table "public"."backoffice_payments" to "authenticated";

grant insert on table "public"."backoffice_payments" to "authenticated";

grant references on table "public"."backoffice_payments" to "authenticated";

grant select on table "public"."backoffice_payments" to "authenticated";

grant trigger on table "public"."backoffice_payments" to "authenticated";

grant truncate on table "public"."backoffice_payments" to "authenticated";

grant update on table "public"."backoffice_payments" to "authenticated";

grant delete on table "public"."backoffice_payments" to "service_role";

grant insert on table "public"."backoffice_payments" to "service_role";

grant references on table "public"."backoffice_payments" to "service_role";

grant select on table "public"."backoffice_payments" to "service_role";

grant trigger on table "public"."backoffice_payments" to "service_role";

grant truncate on table "public"."backoffice_payments" to "service_role";

grant update on table "public"."backoffice_payments" to "service_role";

grant delete on table "public"."backoffice_product_payment_rules" to "anon";

grant insert on table "public"."backoffice_product_payment_rules" to "anon";

grant references on table "public"."backoffice_product_payment_rules" to "anon";

grant select on table "public"."backoffice_product_payment_rules" to "anon";

grant trigger on table "public"."backoffice_product_payment_rules" to "anon";

grant truncate on table "public"."backoffice_product_payment_rules" to "anon";

grant update on table "public"."backoffice_product_payment_rules" to "anon";

grant delete on table "public"."backoffice_product_payment_rules" to "authenticated";

grant insert on table "public"."backoffice_product_payment_rules" to "authenticated";

grant references on table "public"."backoffice_product_payment_rules" to "authenticated";

grant select on table "public"."backoffice_product_payment_rules" to "authenticated";

grant trigger on table "public"."backoffice_product_payment_rules" to "authenticated";

grant truncate on table "public"."backoffice_product_payment_rules" to "authenticated";

grant update on table "public"."backoffice_product_payment_rules" to "authenticated";

grant delete on table "public"."backoffice_product_payment_rules" to "service_role";

grant insert on table "public"."backoffice_product_payment_rules" to "service_role";

grant references on table "public"."backoffice_product_payment_rules" to "service_role";

grant select on table "public"."backoffice_product_payment_rules" to "service_role";

grant trigger on table "public"."backoffice_product_payment_rules" to "service_role";

grant truncate on table "public"."backoffice_product_payment_rules" to "service_role";

grant update on table "public"."backoffice_product_payment_rules" to "service_role";

grant delete on table "public"."backoffice_products" to "anon";

grant insert on table "public"."backoffice_products" to "anon";

grant references on table "public"."backoffice_products" to "anon";

grant select on table "public"."backoffice_products" to "anon";

grant trigger on table "public"."backoffice_products" to "anon";

grant truncate on table "public"."backoffice_products" to "anon";

grant update on table "public"."backoffice_products" to "anon";

grant delete on table "public"."backoffice_products" to "authenticated";

grant insert on table "public"."backoffice_products" to "authenticated";

grant references on table "public"."backoffice_products" to "authenticated";

grant select on table "public"."backoffice_products" to "authenticated";

grant trigger on table "public"."backoffice_products" to "authenticated";

grant truncate on table "public"."backoffice_products" to "authenticated";

grant update on table "public"."backoffice_products" to "authenticated";

grant delete on table "public"."backoffice_products" to "service_role";

grant insert on table "public"."backoffice_products" to "service_role";

grant references on table "public"."backoffice_products" to "service_role";

grant select on table "public"."backoffice_products" to "service_role";

grant trigger on table "public"."backoffice_products" to "service_role";

grant truncate on table "public"."backoffice_products" to "service_role";

grant update on table "public"."backoffice_products" to "service_role";

grant delete on table "public"."backoffice_user_subscriptions" to "anon";

grant insert on table "public"."backoffice_user_subscriptions" to "anon";

grant references on table "public"."backoffice_user_subscriptions" to "anon";

grant select on table "public"."backoffice_user_subscriptions" to "anon";

grant trigger on table "public"."backoffice_user_subscriptions" to "anon";

grant truncate on table "public"."backoffice_user_subscriptions" to "anon";

grant update on table "public"."backoffice_user_subscriptions" to "anon";

grant delete on table "public"."backoffice_user_subscriptions" to "authenticated";

grant insert on table "public"."backoffice_user_subscriptions" to "authenticated";

grant references on table "public"."backoffice_user_subscriptions" to "authenticated";

grant select on table "public"."backoffice_user_subscriptions" to "authenticated";

grant trigger on table "public"."backoffice_user_subscriptions" to "authenticated";

grant truncate on table "public"."backoffice_user_subscriptions" to "authenticated";

grant update on table "public"."backoffice_user_subscriptions" to "authenticated";

grant delete on table "public"."backoffice_user_subscriptions" to "service_role";

grant insert on table "public"."backoffice_user_subscriptions" to "service_role";

grant references on table "public"."backoffice_user_subscriptions" to "service_role";

grant select on table "public"."backoffice_user_subscriptions" to "service_role";

grant trigger on table "public"."backoffice_user_subscriptions" to "service_role";

grant truncate on table "public"."backoffice_user_subscriptions" to "service_role";

grant update on table "public"."backoffice_user_subscriptions" to "service_role";

grant delete on table "public"."backoffice_users" to "anon";

grant insert on table "public"."backoffice_users" to "anon";

grant references on table "public"."backoffice_users" to "anon";

grant select on table "public"."backoffice_users" to "anon";

grant trigger on table "public"."backoffice_users" to "anon";

grant truncate on table "public"."backoffice_users" to "anon";

grant update on table "public"."backoffice_users" to "anon";

grant delete on table "public"."backoffice_users" to "authenticated";

grant insert on table "public"."backoffice_users" to "authenticated";

grant references on table "public"."backoffice_users" to "authenticated";

grant select on table "public"."backoffice_users" to "authenticated";

grant trigger on table "public"."backoffice_users" to "authenticated";

grant truncate on table "public"."backoffice_users" to "authenticated";

grant update on table "public"."backoffice_users" to "authenticated";

grant delete on table "public"."backoffice_users" to "service_role";

grant insert on table "public"."backoffice_users" to "service_role";

grant references on table "public"."backoffice_users" to "service_role";

grant select on table "public"."backoffice_users" to "service_role";

grant trigger on table "public"."backoffice_users" to "service_role";

grant truncate on table "public"."backoffice_users" to "service_role";

grant update on table "public"."backoffice_users" to "service_role";

grant delete on table "public"."backoffice_webhook_events" to "anon";

grant insert on table "public"."backoffice_webhook_events" to "anon";

grant references on table "public"."backoffice_webhook_events" to "anon";

grant select on table "public"."backoffice_webhook_events" to "anon";

grant trigger on table "public"."backoffice_webhook_events" to "anon";

grant truncate on table "public"."backoffice_webhook_events" to "anon";

grant update on table "public"."backoffice_webhook_events" to "anon";

grant delete on table "public"."backoffice_webhook_events" to "authenticated";

grant insert on table "public"."backoffice_webhook_events" to "authenticated";

grant references on table "public"."backoffice_webhook_events" to "authenticated";

grant select on table "public"."backoffice_webhook_events" to "authenticated";

grant trigger on table "public"."backoffice_webhook_events" to "authenticated";

grant truncate on table "public"."backoffice_webhook_events" to "authenticated";

grant update on table "public"."backoffice_webhook_events" to "authenticated";

grant delete on table "public"."backoffice_webhook_events" to "service_role";

grant insert on table "public"."backoffice_webhook_events" to "service_role";

grant references on table "public"."backoffice_webhook_events" to "service_role";

grant select on table "public"."backoffice_webhook_events" to "service_role";

grant trigger on table "public"."backoffice_webhook_events" to "service_role";

grant truncate on table "public"."backoffice_webhook_events" to "service_role";

grant update on table "public"."backoffice_webhook_events" to "service_role";

grant delete on table "public"."backoffice_webhook_request_logs" to "anon";

grant insert on table "public"."backoffice_webhook_request_logs" to "anon";

grant references on table "public"."backoffice_webhook_request_logs" to "anon";

grant select on table "public"."backoffice_webhook_request_logs" to "anon";

grant trigger on table "public"."backoffice_webhook_request_logs" to "anon";

grant truncate on table "public"."backoffice_webhook_request_logs" to "anon";

grant update on table "public"."backoffice_webhook_request_logs" to "anon";

grant delete on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant insert on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant references on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant select on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant trigger on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant truncate on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant update on table "public"."backoffice_webhook_request_logs" to "authenticated";

grant delete on table "public"."backoffice_webhook_request_logs" to "service_role";

grant insert on table "public"."backoffice_webhook_request_logs" to "service_role";

grant references on table "public"."backoffice_webhook_request_logs" to "service_role";

grant select on table "public"."backoffice_webhook_request_logs" to "service_role";

grant trigger on table "public"."backoffice_webhook_request_logs" to "service_role";

grant truncate on table "public"."backoffice_webhook_request_logs" to "service_role";

grant update on table "public"."backoffice_webhook_request_logs" to "service_role";

grant delete on table "public"."backoffice_webhook_tokens" to "anon";

grant insert on table "public"."backoffice_webhook_tokens" to "anon";

grant references on table "public"."backoffice_webhook_tokens" to "anon";

grant select on table "public"."backoffice_webhook_tokens" to "anon";

grant trigger on table "public"."backoffice_webhook_tokens" to "anon";

grant truncate on table "public"."backoffice_webhook_tokens" to "anon";

grant update on table "public"."backoffice_webhook_tokens" to "anon";

grant delete on table "public"."backoffice_webhook_tokens" to "authenticated";

grant insert on table "public"."backoffice_webhook_tokens" to "authenticated";

grant references on table "public"."backoffice_webhook_tokens" to "authenticated";

grant select on table "public"."backoffice_webhook_tokens" to "authenticated";

grant trigger on table "public"."backoffice_webhook_tokens" to "authenticated";

grant truncate on table "public"."backoffice_webhook_tokens" to "authenticated";

grant update on table "public"."backoffice_webhook_tokens" to "authenticated";

grant delete on table "public"."backoffice_webhook_tokens" to "service_role";

grant insert on table "public"."backoffice_webhook_tokens" to "service_role";

grant references on table "public"."backoffice_webhook_tokens" to "service_role";

grant select on table "public"."backoffice_webhook_tokens" to "service_role";

grant trigger on table "public"."backoffice_webhook_tokens" to "service_role";

grant truncate on table "public"."backoffice_webhook_tokens" to "service_role";

grant update on table "public"."backoffice_webhook_tokens" to "service_role";

grant delete on table "public"."corretor_studio_email_campaigns" to "anon";

grant insert on table "public"."corretor_studio_email_campaigns" to "anon";

grant references on table "public"."corretor_studio_email_campaigns" to "anon";

grant select on table "public"."corretor_studio_email_campaigns" to "anon";

grant trigger on table "public"."corretor_studio_email_campaigns" to "anon";

grant truncate on table "public"."corretor_studio_email_campaigns" to "anon";

grant update on table "public"."corretor_studio_email_campaigns" to "anon";

grant delete on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant insert on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant references on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant select on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant trigger on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant truncate on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant update on table "public"."corretor_studio_email_campaigns" to "authenticated";

grant delete on table "public"."corretor_studio_email_campaigns" to "service_role";

grant insert on table "public"."corretor_studio_email_campaigns" to "service_role";

grant references on table "public"."corretor_studio_email_campaigns" to "service_role";

grant select on table "public"."corretor_studio_email_campaigns" to "service_role";

grant trigger on table "public"."corretor_studio_email_campaigns" to "service_role";

grant truncate on table "public"."corretor_studio_email_campaigns" to "service_role";

grant update on table "public"."corretor_studio_email_campaigns" to "service_role";

grant delete on table "public"."corretor_studio_email_contact_lists" to "anon";

grant insert on table "public"."corretor_studio_email_contact_lists" to "anon";

grant references on table "public"."corretor_studio_email_contact_lists" to "anon";

grant select on table "public"."corretor_studio_email_contact_lists" to "anon";

grant trigger on table "public"."corretor_studio_email_contact_lists" to "anon";

grant truncate on table "public"."corretor_studio_email_contact_lists" to "anon";

grant update on table "public"."corretor_studio_email_contact_lists" to "anon";

grant delete on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant insert on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant references on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant select on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant trigger on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant truncate on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant update on table "public"."corretor_studio_email_contact_lists" to "authenticated";

grant delete on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant insert on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant references on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant select on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant trigger on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant truncate on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant update on table "public"."corretor_studio_email_contact_lists" to "service_role";

grant delete on table "public"."corretor_studio_email_contacts" to "anon";

grant insert on table "public"."corretor_studio_email_contacts" to "anon";

grant references on table "public"."corretor_studio_email_contacts" to "anon";

grant select on table "public"."corretor_studio_email_contacts" to "anon";

grant trigger on table "public"."corretor_studio_email_contacts" to "anon";

grant truncate on table "public"."corretor_studio_email_contacts" to "anon";

grant update on table "public"."corretor_studio_email_contacts" to "anon";

grant delete on table "public"."corretor_studio_email_contacts" to "authenticated";

grant insert on table "public"."corretor_studio_email_contacts" to "authenticated";

grant references on table "public"."corretor_studio_email_contacts" to "authenticated";

grant select on table "public"."corretor_studio_email_contacts" to "authenticated";

grant trigger on table "public"."corretor_studio_email_contacts" to "authenticated";

grant truncate on table "public"."corretor_studio_email_contacts" to "authenticated";

grant update on table "public"."corretor_studio_email_contacts" to "authenticated";

grant delete on table "public"."corretor_studio_email_contacts" to "service_role";

grant insert on table "public"."corretor_studio_email_contacts" to "service_role";

grant references on table "public"."corretor_studio_email_contacts" to "service_role";

grant select on table "public"."corretor_studio_email_contacts" to "service_role";

grant trigger on table "public"."corretor_studio_email_contacts" to "service_role";

grant truncate on table "public"."corretor_studio_email_contacts" to "service_role";

grant update on table "public"."corretor_studio_email_contacts" to "service_role";

grant delete on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant insert on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant references on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant select on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant trigger on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant truncate on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant update on table "public"."corretor_studio_email_credit_subscriptions" to "anon";

grant delete on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant insert on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant references on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant select on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant trigger on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant truncate on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant update on table "public"."corretor_studio_email_credit_subscriptions" to "authenticated";

grant delete on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant insert on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant references on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant select on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant trigger on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant truncate on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant update on table "public"."corretor_studio_email_credit_subscriptions" to "service_role";

grant delete on table "public"."corretor_studio_email_credit_usages" to "anon";

grant insert on table "public"."corretor_studio_email_credit_usages" to "anon";

grant references on table "public"."corretor_studio_email_credit_usages" to "anon";

grant select on table "public"."corretor_studio_email_credit_usages" to "anon";

grant trigger on table "public"."corretor_studio_email_credit_usages" to "anon";

grant truncate on table "public"."corretor_studio_email_credit_usages" to "anon";

grant update on table "public"."corretor_studio_email_credit_usages" to "anon";

grant delete on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant insert on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant references on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant select on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant trigger on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant truncate on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant update on table "public"."corretor_studio_email_credit_usages" to "authenticated";

grant delete on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant insert on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant references on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant select on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant trigger on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant truncate on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant update on table "public"."corretor_studio_email_credit_usages" to "service_role";

grant delete on table "public"."corretor_studio_email_events" to "anon";

grant insert on table "public"."corretor_studio_email_events" to "anon";

grant references on table "public"."corretor_studio_email_events" to "anon";

grant select on table "public"."corretor_studio_email_events" to "anon";

grant trigger on table "public"."corretor_studio_email_events" to "anon";

grant truncate on table "public"."corretor_studio_email_events" to "anon";

grant update on table "public"."corretor_studio_email_events" to "anon";

grant delete on table "public"."corretor_studio_email_events" to "authenticated";

grant insert on table "public"."corretor_studio_email_events" to "authenticated";

grant references on table "public"."corretor_studio_email_events" to "authenticated";

grant select on table "public"."corretor_studio_email_events" to "authenticated";

grant trigger on table "public"."corretor_studio_email_events" to "authenticated";

grant truncate on table "public"."corretor_studio_email_events" to "authenticated";

grant update on table "public"."corretor_studio_email_events" to "authenticated";

grant delete on table "public"."corretor_studio_email_events" to "service_role";

grant insert on table "public"."corretor_studio_email_events" to "service_role";

grant references on table "public"."corretor_studio_email_events" to "service_role";

grant select on table "public"."corretor_studio_email_events" to "service_role";

grant trigger on table "public"."corretor_studio_email_events" to "service_role";

grant truncate on table "public"."corretor_studio_email_events" to "service_role";

grant update on table "public"."corretor_studio_email_events" to "service_role";

grant delete on table "public"."corretor_studio_email_logs" to "anon";

grant insert on table "public"."corretor_studio_email_logs" to "anon";

grant references on table "public"."corretor_studio_email_logs" to "anon";

grant select on table "public"."corretor_studio_email_logs" to "anon";

grant trigger on table "public"."corretor_studio_email_logs" to "anon";

grant truncate on table "public"."corretor_studio_email_logs" to "anon";

grant update on table "public"."corretor_studio_email_logs" to "anon";

grant delete on table "public"."corretor_studio_email_logs" to "authenticated";

grant insert on table "public"."corretor_studio_email_logs" to "authenticated";

grant references on table "public"."corretor_studio_email_logs" to "authenticated";

grant select on table "public"."corretor_studio_email_logs" to "authenticated";

grant trigger on table "public"."corretor_studio_email_logs" to "authenticated";

grant truncate on table "public"."corretor_studio_email_logs" to "authenticated";

grant update on table "public"."corretor_studio_email_logs" to "authenticated";

grant delete on table "public"."corretor_studio_email_logs" to "service_role";

grant insert on table "public"."corretor_studio_email_logs" to "service_role";

grant references on table "public"."corretor_studio_email_logs" to "service_role";

grant select on table "public"."corretor_studio_email_logs" to "service_role";

grant trigger on table "public"."corretor_studio_email_logs" to "service_role";

grant truncate on table "public"."corretor_studio_email_logs" to "service_role";

grant update on table "public"."corretor_studio_email_logs" to "service_role";

grant delete on table "public"."corretor_studio_email_templates" to "anon";

grant insert on table "public"."corretor_studio_email_templates" to "anon";

grant references on table "public"."corretor_studio_email_templates" to "anon";

grant select on table "public"."corretor_studio_email_templates" to "anon";

grant trigger on table "public"."corretor_studio_email_templates" to "anon";

grant truncate on table "public"."corretor_studio_email_templates" to "anon";

grant update on table "public"."corretor_studio_email_templates" to "anon";

grant delete on table "public"."corretor_studio_email_templates" to "authenticated";

grant insert on table "public"."corretor_studio_email_templates" to "authenticated";

grant references on table "public"."corretor_studio_email_templates" to "authenticated";

grant select on table "public"."corretor_studio_email_templates" to "authenticated";

grant trigger on table "public"."corretor_studio_email_templates" to "authenticated";

grant truncate on table "public"."corretor_studio_email_templates" to "authenticated";

grant update on table "public"."corretor_studio_email_templates" to "authenticated";

grant delete on table "public"."corretor_studio_email_templates" to "service_role";

grant insert on table "public"."corretor_studio_email_templates" to "service_role";

grant references on table "public"."corretor_studio_email_templates" to "service_role";

grant select on table "public"."corretor_studio_email_templates" to "service_role";

grant trigger on table "public"."corretor_studio_email_templates" to "service_role";

grant truncate on table "public"."corretor_studio_email_templates" to "service_role";

grant update on table "public"."corretor_studio_email_templates" to "service_role";

grant delete on table "public"."corretor_studio_health_plan_options" to "anon";

grant insert on table "public"."corretor_studio_health_plan_options" to "anon";

grant references on table "public"."corretor_studio_health_plan_options" to "anon";

grant select on table "public"."corretor_studio_health_plan_options" to "anon";

grant trigger on table "public"."corretor_studio_health_plan_options" to "anon";

grant truncate on table "public"."corretor_studio_health_plan_options" to "anon";

grant update on table "public"."corretor_studio_health_plan_options" to "anon";

grant delete on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant insert on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant references on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant select on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant trigger on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant truncate on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant update on table "public"."corretor_studio_health_plan_options" to "authenticated";

grant delete on table "public"."corretor_studio_health_plan_options" to "service_role";

grant insert on table "public"."corretor_studio_health_plan_options" to "service_role";

grant references on table "public"."corretor_studio_health_plan_options" to "service_role";

grant select on table "public"."corretor_studio_health_plan_options" to "service_role";

grant trigger on table "public"."corretor_studio_health_plan_options" to "service_role";

grant truncate on table "public"."corretor_studio_health_plan_options" to "service_role";

grant update on table "public"."corretor_studio_health_plan_options" to "service_role";

grant delete on table "public"."corretor_studio_lead_activities" to "anon";

grant insert on table "public"."corretor_studio_lead_activities" to "anon";

grant references on table "public"."corretor_studio_lead_activities" to "anon";

grant select on table "public"."corretor_studio_lead_activities" to "anon";

grant trigger on table "public"."corretor_studio_lead_activities" to "anon";

grant truncate on table "public"."corretor_studio_lead_activities" to "anon";

grant update on table "public"."corretor_studio_lead_activities" to "anon";

grant delete on table "public"."corretor_studio_lead_activities" to "authenticated";

grant insert on table "public"."corretor_studio_lead_activities" to "authenticated";

grant references on table "public"."corretor_studio_lead_activities" to "authenticated";

grant select on table "public"."corretor_studio_lead_activities" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_activities" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_activities" to "authenticated";

grant update on table "public"."corretor_studio_lead_activities" to "authenticated";

grant delete on table "public"."corretor_studio_lead_activities" to "service_role";

grant insert on table "public"."corretor_studio_lead_activities" to "service_role";

grant references on table "public"."corretor_studio_lead_activities" to "service_role";

grant select on table "public"."corretor_studio_lead_activities" to "service_role";

grant trigger on table "public"."corretor_studio_lead_activities" to "service_role";

grant truncate on table "public"."corretor_studio_lead_activities" to "service_role";

grant update on table "public"."corretor_studio_lead_activities" to "service_role";

grant delete on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant insert on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant references on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant select on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant trigger on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant truncate on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant update on table "public"."corretor_studio_lead_activity_reactions" to "anon";

grant delete on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant insert on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant references on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant select on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant update on table "public"."corretor_studio_lead_activity_reactions" to "authenticated";

grant delete on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant insert on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant references on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant select on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant trigger on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant truncate on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant update on table "public"."corretor_studio_lead_activity_reactions" to "service_role";

grant delete on table "public"."corretor_studio_lead_attachments" to "anon";

grant insert on table "public"."corretor_studio_lead_attachments" to "anon";

grant references on table "public"."corretor_studio_lead_attachments" to "anon";

grant select on table "public"."corretor_studio_lead_attachments" to "anon";

grant trigger on table "public"."corretor_studio_lead_attachments" to "anon";

grant truncate on table "public"."corretor_studio_lead_attachments" to "anon";

grant update on table "public"."corretor_studio_lead_attachments" to "anon";

grant delete on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant insert on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant references on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant select on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant update on table "public"."corretor_studio_lead_attachments" to "authenticated";

grant delete on table "public"."corretor_studio_lead_attachments" to "service_role";

grant insert on table "public"."corretor_studio_lead_attachments" to "service_role";

grant references on table "public"."corretor_studio_lead_attachments" to "service_role";

grant select on table "public"."corretor_studio_lead_attachments" to "service_role";

grant trigger on table "public"."corretor_studio_lead_attachments" to "service_role";

grant truncate on table "public"."corretor_studio_lead_attachments" to "service_role";

grant update on table "public"."corretor_studio_lead_attachments" to "service_role";

grant delete on table "public"."corretor_studio_lead_finalized" to "anon";

grant insert on table "public"."corretor_studio_lead_finalized" to "anon";

grant references on table "public"."corretor_studio_lead_finalized" to "anon";

grant select on table "public"."corretor_studio_lead_finalized" to "anon";

grant trigger on table "public"."corretor_studio_lead_finalized" to "anon";

grant truncate on table "public"."corretor_studio_lead_finalized" to "anon";

grant update on table "public"."corretor_studio_lead_finalized" to "anon";

grant delete on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant insert on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant references on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant select on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant update on table "public"."corretor_studio_lead_finalized" to "authenticated";

grant delete on table "public"."corretor_studio_lead_finalized" to "service_role";

grant insert on table "public"."corretor_studio_lead_finalized" to "service_role";

grant references on table "public"."corretor_studio_lead_finalized" to "service_role";

grant select on table "public"."corretor_studio_lead_finalized" to "service_role";

grant trigger on table "public"."corretor_studio_lead_finalized" to "service_role";

grant truncate on table "public"."corretor_studio_lead_finalized" to "service_role";

grant update on table "public"."corretor_studio_lead_finalized" to "service_role";

grant delete on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant insert on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant references on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant select on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant trigger on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant truncate on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant update on table "public"."corretor_studio_lead_finalized_dependents" to "anon";

grant delete on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant insert on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant references on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant select on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant update on table "public"."corretor_studio_lead_finalized_dependents" to "authenticated";

grant delete on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant insert on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant references on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant select on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant trigger on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant truncate on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant update on table "public"."corretor_studio_lead_finalized_dependents" to "service_role";

grant delete on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant insert on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant references on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant select on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant trigger on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant truncate on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant update on table "public"."corretor_studio_lead_finalized_holders" to "anon";

grant delete on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant insert on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant references on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant select on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant update on table "public"."corretor_studio_lead_finalized_holders" to "authenticated";

grant delete on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant insert on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant references on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant select on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant trigger on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant truncate on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant update on table "public"."corretor_studio_lead_finalized_holders" to "service_role";

grant delete on table "public"."corretor_studio_lead_portfolio" to "anon";

grant insert on table "public"."corretor_studio_lead_portfolio" to "anon";

grant references on table "public"."corretor_studio_lead_portfolio" to "anon";

grant select on table "public"."corretor_studio_lead_portfolio" to "anon";

grant trigger on table "public"."corretor_studio_lead_portfolio" to "anon";

grant truncate on table "public"."corretor_studio_lead_portfolio" to "anon";

grant update on table "public"."corretor_studio_lead_portfolio" to "anon";

grant delete on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant insert on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant references on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant select on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant trigger on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant truncate on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant update on table "public"."corretor_studio_lead_portfolio" to "authenticated";

grant delete on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant insert on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant references on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant select on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant trigger on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant truncate on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant update on table "public"."corretor_studio_lead_portfolio" to "service_role";

grant delete on table "public"."corretor_studio_leads" to "anon";

grant insert on table "public"."corretor_studio_leads" to "anon";

grant references on table "public"."corretor_studio_leads" to "anon";

grant select on table "public"."corretor_studio_leads" to "anon";

grant trigger on table "public"."corretor_studio_leads" to "anon";

grant truncate on table "public"."corretor_studio_leads" to "anon";

grant update on table "public"."corretor_studio_leads" to "anon";

grant delete on table "public"."corretor_studio_leads" to "authenticated";

grant insert on table "public"."corretor_studio_leads" to "authenticated";

grant references on table "public"."corretor_studio_leads" to "authenticated";

grant select on table "public"."corretor_studio_leads" to "authenticated";

grant trigger on table "public"."corretor_studio_leads" to "authenticated";

grant truncate on table "public"."corretor_studio_leads" to "authenticated";

grant update on table "public"."corretor_studio_leads" to "authenticated";

grant delete on table "public"."corretor_studio_leads" to "service_role";

grant insert on table "public"."corretor_studio_leads" to "service_role";

grant references on table "public"."corretor_studio_leads" to "service_role";

grant select on table "public"."corretor_studio_leads" to "service_role";

grant trigger on table "public"."corretor_studio_leads" to "service_role";

grant truncate on table "public"."corretor_studio_leads" to "service_role";

grant update on table "public"."corretor_studio_leads" to "service_role";

grant delete on table "public"."corretor_studio_leads_schedule" to "anon";

grant insert on table "public"."corretor_studio_leads_schedule" to "anon";

grant references on table "public"."corretor_studio_leads_schedule" to "anon";

grant select on table "public"."corretor_studio_leads_schedule" to "anon";

grant trigger on table "public"."corretor_studio_leads_schedule" to "anon";

grant truncate on table "public"."corretor_studio_leads_schedule" to "anon";

grant update on table "public"."corretor_studio_leads_schedule" to "anon";

grant delete on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant insert on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant references on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant select on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant trigger on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant truncate on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant update on table "public"."corretor_studio_leads_schedule" to "authenticated";

grant delete on table "public"."corretor_studio_leads_schedule" to "service_role";

grant insert on table "public"."corretor_studio_leads_schedule" to "service_role";

grant references on table "public"."corretor_studio_leads_schedule" to "service_role";

grant select on table "public"."corretor_studio_leads_schedule" to "service_role";

grant trigger on table "public"."corretor_studio_leads_schedule" to "service_role";

grant truncate on table "public"."corretor_studio_leads_schedule" to "service_role";

grant update on table "public"."corretor_studio_leads_schedule" to "service_role";

grant delete on table "public"."corretor_studio_notifications" to "anon";

grant insert on table "public"."corretor_studio_notifications" to "anon";

grant references on table "public"."corretor_studio_notifications" to "anon";

grant select on table "public"."corretor_studio_notifications" to "anon";

grant trigger on table "public"."corretor_studio_notifications" to "anon";

grant truncate on table "public"."corretor_studio_notifications" to "anon";

grant update on table "public"."corretor_studio_notifications" to "anon";

grant delete on table "public"."corretor_studio_notifications" to "authenticated";

grant insert on table "public"."corretor_studio_notifications" to "authenticated";

grant references on table "public"."corretor_studio_notifications" to "authenticated";

grant select on table "public"."corretor_studio_notifications" to "authenticated";

grant trigger on table "public"."corretor_studio_notifications" to "authenticated";

grant truncate on table "public"."corretor_studio_notifications" to "authenticated";

grant update on table "public"."corretor_studio_notifications" to "authenticated";

grant delete on table "public"."corretor_studio_notifications" to "service_role";

grant insert on table "public"."corretor_studio_notifications" to "service_role";

grant references on table "public"."corretor_studio_notifications" to "service_role";

grant select on table "public"."corretor_studio_notifications" to "service_role";

grant trigger on table "public"."corretor_studio_notifications" to "service_role";

grant truncate on table "public"."corretor_studio_notifications" to "service_role";

grant update on table "public"."corretor_studio_notifications" to "service_role";

grant delete on table "public"."corretor_studio_pending_actions" to "anon";

grant insert on table "public"."corretor_studio_pending_actions" to "anon";

grant references on table "public"."corretor_studio_pending_actions" to "anon";

grant select on table "public"."corretor_studio_pending_actions" to "anon";

grant trigger on table "public"."corretor_studio_pending_actions" to "anon";

grant truncate on table "public"."corretor_studio_pending_actions" to "anon";

grant update on table "public"."corretor_studio_pending_actions" to "anon";

grant delete on table "public"."corretor_studio_pending_actions" to "authenticated";

grant insert on table "public"."corretor_studio_pending_actions" to "authenticated";

grant references on table "public"."corretor_studio_pending_actions" to "authenticated";

grant select on table "public"."corretor_studio_pending_actions" to "authenticated";

grant trigger on table "public"."corretor_studio_pending_actions" to "authenticated";

grant truncate on table "public"."corretor_studio_pending_actions" to "authenticated";

grant update on table "public"."corretor_studio_pending_actions" to "authenticated";

grant delete on table "public"."corretor_studio_pending_actions" to "service_role";

grant insert on table "public"."corretor_studio_pending_actions" to "service_role";

grant references on table "public"."corretor_studio_pending_actions" to "service_role";

grant select on table "public"."corretor_studio_pending_actions" to "service_role";

grant trigger on table "public"."corretor_studio_pending_actions" to "service_role";

grant truncate on table "public"."corretor_studio_pending_actions" to "service_role";

grant update on table "public"."corretor_studio_pending_actions" to "service_role";

grant delete on table "public"."corretor_studio_pending_operators" to "anon";

grant insert on table "public"."corretor_studio_pending_operators" to "anon";

grant references on table "public"."corretor_studio_pending_operators" to "anon";

grant select on table "public"."corretor_studio_pending_operators" to "anon";

grant trigger on table "public"."corretor_studio_pending_operators" to "anon";

grant truncate on table "public"."corretor_studio_pending_operators" to "anon";

grant update on table "public"."corretor_studio_pending_operators" to "anon";

grant delete on table "public"."corretor_studio_pending_operators" to "authenticated";

grant insert on table "public"."corretor_studio_pending_operators" to "authenticated";

grant references on table "public"."corretor_studio_pending_operators" to "authenticated";

grant select on table "public"."corretor_studio_pending_operators" to "authenticated";

grant trigger on table "public"."corretor_studio_pending_operators" to "authenticated";

grant truncate on table "public"."corretor_studio_pending_operators" to "authenticated";

grant update on table "public"."corretor_studio_pending_operators" to "authenticated";

grant delete on table "public"."corretor_studio_pending_operators" to "service_role";

grant insert on table "public"."corretor_studio_pending_operators" to "service_role";

grant references on table "public"."corretor_studio_pending_operators" to "service_role";

grant select on table "public"."corretor_studio_pending_operators" to "service_role";

grant trigger on table "public"."corretor_studio_pending_operators" to "service_role";

grant truncate on table "public"."corretor_studio_pending_operators" to "service_role";

grant update on table "public"."corretor_studio_pending_operators" to "service_role";

grant delete on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant insert on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant references on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant select on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant trigger on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant truncate on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant update on table "public"."corretor_studio_profile_subscription_capacities" to "anon";

grant delete on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant insert on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant references on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant select on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant trigger on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant truncate on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant update on table "public"."corretor_studio_profile_subscription_capacities" to "authenticated";

grant delete on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant insert on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant references on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant select on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant trigger on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant truncate on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant update on table "public"."corretor_studio_profile_subscription_capacities" to "service_role";

grant delete on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant insert on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant references on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant select on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant trigger on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant truncate on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant update on table "public"."corretor_studio_profile_subscriptions" to "anon";

grant delete on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant insert on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant references on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant select on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant trigger on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant truncate on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant update on table "public"."corretor_studio_profile_subscriptions" to "authenticated";

grant delete on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant insert on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant references on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant select on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant trigger on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant truncate on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant update on table "public"."corretor_studio_profile_subscriptions" to "service_role";

grant delete on table "public"."corretor_studio_profiles" to "anon";

grant insert on table "public"."corretor_studio_profiles" to "anon";

grant references on table "public"."corretor_studio_profiles" to "anon";

grant select on table "public"."corretor_studio_profiles" to "anon";

grant trigger on table "public"."corretor_studio_profiles" to "anon";

grant truncate on table "public"."corretor_studio_profiles" to "anon";

grant update on table "public"."corretor_studio_profiles" to "anon";

grant delete on table "public"."corretor_studio_profiles" to "authenticated";

grant insert on table "public"."corretor_studio_profiles" to "authenticated";

grant references on table "public"."corretor_studio_profiles" to "authenticated";

grant select on table "public"."corretor_studio_profiles" to "authenticated";

grant trigger on table "public"."corretor_studio_profiles" to "authenticated";

grant truncate on table "public"."corretor_studio_profiles" to "authenticated";

grant update on table "public"."corretor_studio_profiles" to "authenticated";

grant delete on table "public"."corretor_studio_profiles" to "service_role";

grant insert on table "public"."corretor_studio_profiles" to "service_role";

grant references on table "public"."corretor_studio_profiles" to "service_role";

grant select on table "public"."corretor_studio_profiles" to "service_role";

grant trigger on table "public"."corretor_studio_profiles" to "service_role";

grant truncate on table "public"."corretor_studio_profiles" to "service_role";

grant update on table "public"."corretor_studio_profiles" to "service_role";

grant delete on table "public"."corretor_studio_task_assignees" to "anon";

grant insert on table "public"."corretor_studio_task_assignees" to "anon";

grant references on table "public"."corretor_studio_task_assignees" to "anon";

grant select on table "public"."corretor_studio_task_assignees" to "anon";

grant trigger on table "public"."corretor_studio_task_assignees" to "anon";

grant truncate on table "public"."corretor_studio_task_assignees" to "anon";

grant update on table "public"."corretor_studio_task_assignees" to "anon";

grant delete on table "public"."corretor_studio_task_assignees" to "authenticated";

grant insert on table "public"."corretor_studio_task_assignees" to "authenticated";

grant references on table "public"."corretor_studio_task_assignees" to "authenticated";

grant select on table "public"."corretor_studio_task_assignees" to "authenticated";

grant trigger on table "public"."corretor_studio_task_assignees" to "authenticated";

grant truncate on table "public"."corretor_studio_task_assignees" to "authenticated";

grant update on table "public"."corretor_studio_task_assignees" to "authenticated";

grant delete on table "public"."corretor_studio_task_assignees" to "service_role";

grant insert on table "public"."corretor_studio_task_assignees" to "service_role";

grant references on table "public"."corretor_studio_task_assignees" to "service_role";

grant select on table "public"."corretor_studio_task_assignees" to "service_role";

grant trigger on table "public"."corretor_studio_task_assignees" to "service_role";

grant truncate on table "public"."corretor_studio_task_assignees" to "service_role";

grant update on table "public"."corretor_studio_task_assignees" to "service_role";

grant delete on table "public"."corretor_studio_tasks" to "anon";

grant insert on table "public"."corretor_studio_tasks" to "anon";

grant references on table "public"."corretor_studio_tasks" to "anon";

grant select on table "public"."corretor_studio_tasks" to "anon";

grant trigger on table "public"."corretor_studio_tasks" to "anon";

grant truncate on table "public"."corretor_studio_tasks" to "anon";

grant update on table "public"."corretor_studio_tasks" to "anon";

grant delete on table "public"."corretor_studio_tasks" to "authenticated";

grant insert on table "public"."corretor_studio_tasks" to "authenticated";

grant references on table "public"."corretor_studio_tasks" to "authenticated";

grant select on table "public"."corretor_studio_tasks" to "authenticated";

grant trigger on table "public"."corretor_studio_tasks" to "authenticated";

grant truncate on table "public"."corretor_studio_tasks" to "authenticated";

grant update on table "public"."corretor_studio_tasks" to "authenticated";

grant delete on table "public"."corretor_studio_tasks" to "service_role";

grant insert on table "public"."corretor_studio_tasks" to "service_role";

grant references on table "public"."corretor_studio_tasks" to "service_role";

grant select on table "public"."corretor_studio_tasks" to "service_role";

grant trigger on table "public"."corretor_studio_tasks" to "service_role";

grant truncate on table "public"."corretor_studio_tasks" to "service_role";

grant update on table "public"."corretor_studio_tasks" to "service_role";

grant delete on table "public"."corretor_studio_team_filter_presets" to "anon";

grant insert on table "public"."corretor_studio_team_filter_presets" to "anon";

grant references on table "public"."corretor_studio_team_filter_presets" to "anon";

grant select on table "public"."corretor_studio_team_filter_presets" to "anon";

grant trigger on table "public"."corretor_studio_team_filter_presets" to "anon";

grant truncate on table "public"."corretor_studio_team_filter_presets" to "anon";

grant update on table "public"."corretor_studio_team_filter_presets" to "anon";

grant delete on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant insert on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant references on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant select on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant trigger on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant truncate on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant update on table "public"."corretor_studio_team_filter_presets" to "authenticated";

grant delete on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant insert on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant references on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant select on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant trigger on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant truncate on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant update on table "public"."corretor_studio_team_filter_presets" to "service_role";

grant delete on table "public"."corretor_studio_team_members" to "anon";

grant insert on table "public"."corretor_studio_team_members" to "anon";

grant references on table "public"."corretor_studio_team_members" to "anon";

grant select on table "public"."corretor_studio_team_members" to "anon";

grant trigger on table "public"."corretor_studio_team_members" to "anon";

grant truncate on table "public"."corretor_studio_team_members" to "anon";

grant update on table "public"."corretor_studio_team_members" to "anon";

grant delete on table "public"."corretor_studio_team_members" to "authenticated";

grant insert on table "public"."corretor_studio_team_members" to "authenticated";

grant references on table "public"."corretor_studio_team_members" to "authenticated";

grant select on table "public"."corretor_studio_team_members" to "authenticated";

grant trigger on table "public"."corretor_studio_team_members" to "authenticated";

grant truncate on table "public"."corretor_studio_team_members" to "authenticated";

grant update on table "public"."corretor_studio_team_members" to "authenticated";

grant delete on table "public"."corretor_studio_team_members" to "service_role";

grant insert on table "public"."corretor_studio_team_members" to "service_role";

grant references on table "public"."corretor_studio_team_members" to "service_role";

grant select on table "public"."corretor_studio_team_members" to "service_role";

grant trigger on table "public"."corretor_studio_team_members" to "service_role";

grant truncate on table "public"."corretor_studio_team_members" to "service_role";

grant update on table "public"."corretor_studio_team_members" to "service_role";

grant delete on table "public"."corretor_studio_team_status_rules" to "anon";

grant insert on table "public"."corretor_studio_team_status_rules" to "anon";

grant references on table "public"."corretor_studio_team_status_rules" to "anon";

grant select on table "public"."corretor_studio_team_status_rules" to "anon";

grant trigger on table "public"."corretor_studio_team_status_rules" to "anon";

grant truncate on table "public"."corretor_studio_team_status_rules" to "anon";

grant update on table "public"."corretor_studio_team_status_rules" to "anon";

grant delete on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant insert on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant references on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant select on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant trigger on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant truncate on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant update on table "public"."corretor_studio_team_status_rules" to "authenticated";

grant delete on table "public"."corretor_studio_team_status_rules" to "service_role";

grant insert on table "public"."corretor_studio_team_status_rules" to "service_role";

grant references on table "public"."corretor_studio_team_status_rules" to "service_role";

grant select on table "public"."corretor_studio_team_status_rules" to "service_role";

grant trigger on table "public"."corretor_studio_team_status_rules" to "service_role";

grant truncate on table "public"."corretor_studio_team_status_rules" to "service_role";

grant update on table "public"."corretor_studio_team_status_rules" to "service_role";

grant delete on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant insert on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant references on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant select on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant trigger on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant truncate on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant update on table "public"."corretor_studio_team_studio_webhook_configs" to "anon";

grant delete on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant insert on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant references on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant select on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant trigger on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant truncate on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant update on table "public"."corretor_studio_team_studio_webhook_configs" to "authenticated";

grant delete on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant insert on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant references on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant select on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant trigger on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant truncate on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant update on table "public"."corretor_studio_team_studio_webhook_configs" to "service_role";

grant delete on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant insert on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant references on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant select on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant trigger on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant truncate on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant update on table "public"."corretor_studio_team_studio_webhook_request_logs" to "anon";

grant delete on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant insert on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant references on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant select on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant trigger on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant truncate on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant update on table "public"."corretor_studio_team_studio_webhook_request_logs" to "authenticated";

grant delete on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant insert on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant references on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant select on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant trigger on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant truncate on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant update on table "public"."corretor_studio_team_studio_webhook_request_logs" to "service_role";

grant delete on table "public"."corretor_studio_teams" to "anon";

grant insert on table "public"."corretor_studio_teams" to "anon";

grant references on table "public"."corretor_studio_teams" to "anon";

grant select on table "public"."corretor_studio_teams" to "anon";

grant trigger on table "public"."corretor_studio_teams" to "anon";

grant truncate on table "public"."corretor_studio_teams" to "anon";

grant update on table "public"."corretor_studio_teams" to "anon";

grant delete on table "public"."corretor_studio_teams" to "authenticated";

grant insert on table "public"."corretor_studio_teams" to "authenticated";

grant references on table "public"."corretor_studio_teams" to "authenticated";

grant select on table "public"."corretor_studio_teams" to "authenticated";

grant trigger on table "public"."corretor_studio_teams" to "authenticated";

grant truncate on table "public"."corretor_studio_teams" to "authenticated";

grant update on table "public"."corretor_studio_teams" to "authenticated";

grant delete on table "public"."corretor_studio_teams" to "service_role";

grant insert on table "public"."corretor_studio_teams" to "service_role";

grant references on table "public"."corretor_studio_teams" to "service_role";

grant select on table "public"."corretor_studio_teams" to "service_role";

grant trigger on table "public"."corretor_studio_teams" to "service_role";

grant truncate on table "public"."corretor_studio_teams" to "service_role";

grant update on table "public"."corretor_studio_teams" to "service_role";


