```mermaid
erDiagram

        UserRole {
            manager manager
backoffice backoffice
operator operator
        }
    


        UserFunction {
            SDR SDR
CLOSER CLOSER
        }
    


        MeetingHeald {
            yes yes
no no
        }
    


        LeadStatus {
            new_opportunity new_opportunity
scheduled scheduled
no_show no_show
pricingRequest pricingRequest
future_sale future_sale
offerNegotiation offerNegotiation
pending_documents pending_documents
offerSubmission offerSubmission
dps_agreement dps_agreement
invoicePayment invoicePayment
disqualified disqualified
opportunityLost opportunityLost
operator_denied operator_denied
contract_finalized contract_finalized
        }
    


        LeadProposalReviewStatus {
            pending pending
submitted submitted
criticized criticized
approved approved
        }
    


        LeadRequiredDocumentType {
            rg rg
address_proof address_proof
social_contract social_contract
        }
    


        LeadRequiredDocumentStatus {
            pending pending
uploaded uploaded
approved approved
rejected rejected
        }
    


        LeadOriginChannel {
            manual manual
csv_import csv_import
public_form public_form
legacy_public_widget legacy_public_widget
studio_webhook studio_webhook
meta_webhook meta_webhook
whatsapp_manual whatsapp_manual
email_campaign email_campaign
        }
    


        backoffice_lead_status {
            new_opportunity new_opportunity
scheduled scheduled
no_show no_show
new_adhesion new_adhesion
lost lost
implementation implementation
finalized finalized
proposal proposal
future_contact future_contact
deal_closed deal_closed
disqualified disqualified
        }
    


        backoffice_adhesion_status {
            pending pending
paid paid
overdue overdue
expired expired
canceled canceled
        }
    


        backoffice_adhesion_plan {
            crm crm
        }
    


        backoffice_adhesion_billing_cycle {
            monthly monthly
quarterly quarterly
quadrimester quadrimester
semiannual semiannual
annual annual
        }
    


        backoffice_lead_origin {
            manual manual
webhook_meta webhook_meta
landing_page landing_page
public_form public_form
        }
    


        backoffice_webhook_source {
            meta meta
        }
    


        backoffice_webhook_event_status {
            received received
processed processed
failed failed
        }
    


        asaas_webhook_event_status {
            pending pending
processing processing
processed processed
failed failed
        }
    


        asaas_account {
            primary primary
legacy legacy
        }
    


        backoffice_webhook_token_status {
            active active
replaced replaced
expired expired
        }
    


        backoffice_webhook_token_expiry_mode {
            hours_24 hours_24
months_6 months_6
indeterminate indeterminate
        }
    


        backoffice_cron_status {
            running running
success success
failed failed
        }
    


        filter_preset_scope {
            crm crm
performance performance
board board
carteira carteira
        }
    


        filter_preset_visibility {
            private private
team team
        }
    


        TeamStatusRuleType {
            disabled_status disabled_status
lead_time lead_time
combined_transition combined_transition
        }
    


        BackofficeLeadTransitionFieldKey {
            age age
currentHealthPlan currentHealthPlan
referenceHospital referenceHospital
currentTreatment currentTreatment
email email
phone phone
cnpj cnpj
        }
    


        BackofficeLeadTransitionGateType {
            allowed_target_statuses allowed_target_statuses
block_targets_when_field_equals block_targets_when_field_equals
require_meeting_heald_on_exit require_meeting_heald_on_exit
require_no_show_preconditions require_no_show_preconditions
require_sales_info require_sales_info
require_finalize_contract require_finalize_contract
require_schedule_artifacts require_schedule_artifacts
require_trigger_future_sale require_trigger_future_sale
require_trigger_loss_reason require_trigger_loss_reason
require_email_for_online_schedule require_email_for_online_schedule
require_finalize_contract_flow require_finalize_contract_flow
require_closer require_closer
        }
    


        TeamLeadTimeUnit {
            hours hours
days days
        }
    


        ActivityType {
            note note
call call
whatsapp whatsapp
email email
status_change status_change
task task
studio_bot studio_bot
meeting meeting
visit visit
missed missed
        }
    


        task_type {
            call call
documentation documentation
email email
proposal proposal
whatsapp whatsapp
meeting meeting
other other
        }
    


        task_assignee_status {
            PENDING PENDING
IN_PROGRESS IN_PROGRESS
DONE DONE
CANCELED CANCELED
OVERDUE OVERDUE
        }
    


        InviteDispatchStatus {
            sent_google sent_google
sent_resend sent_resend
failed failed
        }
    


        BackofficeInviteDispatchStatus {
            sent_google sent_google
sent_resend sent_resend
failed failed
        }
    


        backoffice_email_dispatch_provider {
            resend resend
google_calendar google_calendar
        }
    


        backoffice_email_recipient_kind {
            account account
google google
external external
        }
    


        backoffice_email_dispatch_category {
            access_invite access_invite
access_reset access_reset
invoice_notification invoice_notification
adhesion_invite adhesion_invite
schedule_invite schedule_invite
welcome welcome
operator_invite operator_invite
meeting_invite meeting_invite
other other
        }
    


        backoffice_email_dispatch_status {
            queued queued
sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
failed failed
delivery_delayed delivery_delayed
suppressed suppressed
        }
    


        backoffice_email_dispatch_event_type {
            sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
delivery_delayed delivery_delayed
unsubscribed unsubscribed
suppressed suppressed
failed failed
        }
    


        backoffice_email_campaign_status {
            draft draft
scheduled scheduled
sending sending
sent sent
canceled canceled
failed failed
        }
    


        backoffice_email_campaign_type {
            live_weekly live_weekly
        }
    


        backoffice_email_campaign_dispatch_status {
            sending sending
completed completed
failed failed
        }
    


        backoffice_email_log_status {
            queued queued
sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
failed failed
        }
    


        backoffice_email_event_type {
            sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
delivery_delayed delivery_delayed
unsubscribed unsubscribed
failed failed
        }
    


        backoffice_email_orphan_event_status {
            pending pending
processed processed
failed failed
skipped skipped
        }
    


        backoffice_email_import_job_status {
            pending pending
processing processing
completed completed
failed failed
        }
    


        backoffice_email_import_source_format {
            csv csv
json json
        }
    


        backoffice_product_type {
            PLAN PLAN
ADDON ADDON
        }
    


        backoffice_product_billing_mode {
            RECURRING RECURRING
LIFETIME LIFETIME
        }
    


        installment_split_mode {
            EQUAL EQUAL
CUSTOM CUSTOM
        }
    


        backoffice_payment_method {
            PIX PIX
CREDIT_CARD CREDIT_CARD
        }
    


        backoffice_subscription_status {
            active active
suspended suspended
canceled canceled
expired expired
        }
    


        backoffice_feature_access_mode {
            PUBLIC PUBLIC
PAID PAID
ADDON ADDON
        }
    


        backoffice_feature_access_level {
            NONE NONE
READ READ
FULL FULL
        }
    


        backoffice_feature_grant_type {
            BETA BETA
        }
    


        backoffice_ban_status {
            ACTIVE ACTIVE
LIFTED LIFTED
        }
    


        backoffice_ban_scope {
            INDIVIDUAL INDIVIDUAL
ACCOUNT ACCOUNT
        }
    


        backoffice_beta_team_scope {
            ALL_TEAMS ALL_TEAMS
SPECIFIC_TEAMS SPECIFIC_TEAMS
        }
    


        backoffice_access_principal {
            MASTER MASTER
MANAGER MANAGER
BACKOFFICE BACKOFFICE
OPERATOR OPERATOR
SDR SDR
CLOSER CLOSER
CAN_MANAGE_TEAMS CAN_MANAGE_TEAMS
CAN_CREATE_USERS CAN_CREATE_USERS
        }
    


        backoffice_deletion_entity_type {
            LEAD LEAD
TEAM TEAM
PROFILE PROFILE
TEAM_MEMBERSHIP TEAM_MEMBERSHIP
        }
    


        backoffice_deletion_request_type {
            USER_DELETE USER_DELETE
TEAM_DELETE TEAM_DELETE
        }
    


        backoffice_deletion_request_status {
            pending pending
approved approved
rejected rejected
cancelled cancelled
        }
    


        backoffice_deletion_approval_decision {
            approved approved
rejected rejected
        }
    


        backoffice_database_backup_status {
            pending pending
success success
failed failed
        }
    


        backoffice_database_backup_source {
            cron cron
manual manual
        }
    


        subscription_status {
            trial trial
active active
past_due past_due
suspended suspended
canceled canceled
        }
    


        subscription_plan {
            free_trial free_trial
manager_base manager_base
with_operators with_operators
        }
    


        pending_action_type {
            create_team create_team
add_member add_member
add_user add_user
transfer_team transfer_team
update_subscription_credits update_subscription_credits
        }
    


        pending_action_status {
            pending pending
applied applied
failed failed
canceled canceled
        }
    


        platform_purchase_type {
            email_credits email_credits
feature_addon feature_addon
radar_self_service radar_self_service
radar_managed radar_managed
subscription_capacity subscription_capacity
        }
    


        platform_purchase_status {
            pending pending
awaiting_payment awaiting_payment
paid paid
failed failed
canceled canceled
        }
    


        asaas_notification_backfill_status {
            pending pending
completed completed
failed failed
        }
    


        notification_type {
            ACTIVITY_MENTION ACTIVITY_MENTION
ACTIVITY_REACTION ACTIVITY_REACTION
TEAM_MEMBER_ADDED TEAM_MEMBER_ADDED
TEAM_MEMBER_REMOVED TEAM_MEMBER_REMOVED
LEAD_SCHEDULE_CREATED LEAD_SCHEDULE_CREATED
LEAD_PROPOSAL_PENDING LEAD_PROPOSAL_PENDING
GOOGLE_CONNECTION_BROKEN GOOGLE_CONNECTION_BROKEN
LEAD_TRANSFER_ACTIVATED LEAD_TRANSFER_ACTIVATED
MEETING_REMINDER MEETING_REMINDER
LEAD_TRANSFER_SCHEDULE_FAILED LEAD_TRANSFER_SCHEDULE_FAILED
MEETING_FOLLOW_UP_DIGEST MEETING_FOLLOW_UP_DIGEST
BETHANIA_AUTH_CODE BETHANIA_AUTH_CODE
EMAIL_IMPORT_COMPLETED EMAIL_IMPORT_COMPLETED
EMAIL_CAMPAIGN_DISPATCH_FAILED EMAIL_CAMPAIGN_DISPATCH_FAILED
AUTOMATION_RULE AUTOMATION_RULE
WEBHOOK_AUTO_PAUSED WEBHOOK_AUTO_PAUSED
LEAD_DOCUMENT_UPLOADED LEAD_DOCUMENT_UPLOADED
LEAD_DOCUMENT_REQUEST_COMPLETED LEAD_DOCUMENT_REQUEST_COMPLETED
        }
    


        team_webhook_direction {
            inbound inbound
outbound outbound
        }
    


        team_webhook_status {
            active active
paused paused
disabled disabled
        }
    


        team_webhook_destination_preset {
            generic generic
slack slack
teams teams
zapier zapier
        }
    


        team_webhook_event_key {
            lead_created lead_created
lead_status_changed lead_status_changed
lead_assigned lead_assigned
appointment_created appointment_created
appointment_reminder appointment_reminder
activity_created activity_created
        }
    


        team_webhook_log_result {
            success success
failure failure
rejected rejected
        }
    


        team_webhook_outbox_status {
            pending pending
processing processing
delivered delivered
failed failed
cancelled cancelled
        }
    


        team_automation_trigger_type {
            lead_created lead_created
status_changed status_changed
lead_idle_in_status lead_idle_in_status
meeting_scheduled meeting_scheduled
meeting_no_show meeting_no_show
        }
    


        team_automation_action_type {
            send_whatsapp_message send_whatsapp_message
send_email send_email
create_notification create_notification
assign_operator assign_operator
        }
    


        team_automation_run_status {
            success success
failed failed
skipped skipped
        }
    


        web_push_consent_status {
            accepted accepted
declined declined
dismissed dismissed
        }
    


        studio_webhook_token_expiry_mode {
            hours_24 hours_24
months_6 months_6
indeterminate indeterminate
        }
    


        portfolio_status {
            active active
pending pending
canceled canceled
        }
    


        portfolio_source {
            crm crm
manual manual
brokerage_transfer brokerage_transfer
        }
    


        renewal_status {
            to_renew to_renew
contacted contacted
proposal proposal
renewed renewed
lost lost
        }
    


        subscription_cycle {
            MONTHLY MONTHLY
QUARTERLY QUARTERLY
SEMIANNUALLY SEMIANNUALLY
YEARLY YEARLY
        }
    


        contract_type {
            individual individual
corporate corporate
adhesion adhesion
        }
    


        email_credit_plan {
            starter starter
plus plus
pro pro
upgrade upgrade
business business
        }
    


        email_credit_subscription_status {
            active active
suspended suspended
canceled canceled
        }
    


        email_campaign_status {
            draft draft
scheduled scheduled
sending sending
sent sent
partially_sent partially_sent
canceled canceled
failed failed
archived archived
        }
    


        email_campaign_dispatch_status {
            sending sending
completed completed
failed failed
        }
    


        email_campaign_batch_idempotency_scheme {
            positional positional
contentHash contentHash
        }
    


        email_log_status {
            queued queued
sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
suppressed suppressed
failed failed
        }
    


        email_log_category {
            campaign campaign
meeting_invite meeting_invite
schedule_notification schedule_notification
transactional transactional
other other
        }
    


        email_event_type {
            sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
suppressed suppressed
delivery_delayed delivery_delayed
unsubscribed unsubscribed
failed failed
        }
    


        BackofficeOperationalCapability {
            ASSOCIADOS_QUEUE ASSOCIADOS_QUEUE
MULTISKILL_TRANSFER_ORIGIN MULTISKILL_TRANSFER_ORIGIN
        }
    


        AuditEntityType {
            PROFILE PROFILE
TEAM TEAM
TEAM_MEMBER TEAM_MEMBER
        }
    


        AuditAction {
            CREATE CREATE
UPDATE UPDATE
DELETE DELETE
ROLE_CHANGE ROLE_CHANGE
        }
    


        LeadCustomFieldType {
            text text
number number
date date
select select
multi_select multi_select
boolean boolean
        }
    


        email_contact_radar_sync_outbox_status {
            pending pending
processing processing
sent sent
failed failed
        }
    


        email_orphan_event_status {
            pending pending
processing processing
processed processed
failed failed
skipped skipped
        }
    


        public_form_queue_event_kind {
            metric metric
progress progress
submission submission
        }
    


        public_form_queue_event_failure_status {
            pending pending
processing processing
resolved resolved
failed failed
        }
    


        queue_processing_failure_status {
            pending pending
processing processing
resolved resolved
failed failed
        }
    


        resend_webhook_processing_failure_status {
            pending pending
processing processing
resolved resolved
failed failed
        }
    


        WhatsAppProvider {
            EVOLUTION EVOLUTION
        }
    


        WhatsAppEngine {
            OPENWA OPENWA
META META
        }
    


        WhatsAppConnectionStatus {
            PENDING PENDING
INITIALIZING INITIALIZING
QR_READY QR_READY
CONNECTED CONNECTED
DISCONNECTED DISCONNECTED
ERROR ERROR
BANNED BANNED
        }
    


        WhatsAppMessageDirection {
            INBOUND INBOUND
OUTBOUND OUTBOUND
        }
    


        WhatsAppMessageType {
            TEXT TEXT
IMAGE IMAGE
AUDIO AUDIO
VIDEO VIDEO
DOCUMENT DOCUMENT
STICKER STICKER
LOCATION LOCATION
CONTACT CONTACT
UNKNOWN UNKNOWN
        }
    


        WhatsAppMessageStatus {
            PENDING PENDING
SENT SENT
DELIVERED DELIVERED
READ READ
PLAYED PLAYED
UNKNOWN UNKNOWN
FAILED FAILED
RECEIVED RECEIVED
        }
    


        WhatsAppMediaStatus {
            PROCESSING PROCESSING
AVAILABLE AVAILABLE
EXPIRED EXPIRED
FAILED FAILED
        }
    


        WhatsAppMessageActionCommandKind {
            REACT REACT
UNREACT UNREACT
DELETE_FOR_EVERYONE DELETE_FOR_EVERYONE
        }
    


        WhatsAppMessageActionCommandStatus {
            PENDING PENDING
APPLIED APPLIED
UNKNOWN UNKNOWN
FAILED FAILED
        }
    


        WhatsAppOutboundCommandStatus {
            PENDING PENDING
SENT SENT
UNKNOWN UNKNOWN
FAILED FAILED
        }
    


        WhatsAppWebhookEventStatus {
            PENDING PENDING
PROCESSING PROCESSING
PROCESSED PROCESSED
DEAD_LETTER DEAD_LETTER
        }
    


        WhatsAppUsageEventType {
            OUTBOUND_MESSAGE OUTBOUND_MESSAGE
INBOUND_MESSAGE INBOUND_MESSAGE
CONNECTION_EVENT CONNECTION_EVENT
RECONNECTION_EVENT RECONNECTION_EVENT
        }
    


        WhatsAppHistorySyncStatus {
            IDLE IDLE
RUNNING RUNNING
COMPLETED COMPLETED
FAILED FAILED
        }
    


        WhatsAppHandoffMode {
            BOT BOT
HUMAN HUMAN
        }
    


        WhatsAppContactNameSource {
            MANUAL MANUAL
LEAD LEAD
PHONE_BOOK PHONE_BOOK
PUSH_NAME PUSH_NAME
PHONE_NUMBER PHONE_NUMBER
        }
    


        WhatsAppAutoResponseRuleType {
            WELCOME WELCOME
OFF_HOURS OFF_HOURS
KEYWORD KEYWORD
        }
    


        WhatsAppAutoResponseMatchMode {
            CONTAINS CONTAINS
EXACT EXACT
STARTS_WITH STARTS_WITH
        }
    


        TeamWhatsAppContactSource {
            PHONE_CONTACTS PHONE_CONTACTS
GROUP_PARTICIPANT GROUP_PARTICIPANT
        }
    


        WhatsAppContactSyncState {
            FRESH FRESH
STALE STALE
UNRESOLVED UNRESOLVED
CONFLICT CONFLICT
        }
    


        radar_identity_type {
            phone phone
email email
document document
lead_id lead_id
email_contact_id email_contact_id
portfolio_id portfolio_id
whatsapp_contact_id whatsapp_contact_id
visitor_session visitor_session
contract_holder contract_holder
contract_dependent contract_dependent
        }
    


        radar_source_type {
            crm_lead crm_lead
portfolio portfolio
email_contact email_contact
email_campaign email_campaign
whatsapp_contact whatsapp_contact
base_import base_import
pixel_hit pixel_hit
lead_finalized lead_finalized
        }
    


        radar_channel {
            email email
whatsapp whatsapp
        }
    


        radar_consent_status {
            allowed allowed
blocked blocked
unknown unknown
        }
    


        radar_consent_reason {
            manual manual
imported imported
unsubscribe unsubscribe
bounce bounce
complaint complaint
opt_out opt_out
missing_identity missing_identity
        }
    


        email_variable_value_source {
            STATIC STATIC
RADAR RADAR
        }
    


        segment_source_type {
            manual manual
campaign campaign
child child
        }
    


        backoffice_bot_channel_type {
            whatsapp whatsapp
        }
    


        backoffice_bot_channel_status {
            pending pending
connected connected
disconnected disconnected
error error
        }
    


        backoffice_bot_auth_challenge_source {
            channel_email channel_email
web_otp web_otp
        }
    


        backoffice_bot_auth_challenge_status {
            pending pending
verified verified
expired expired
failed failed
        }
    


        backoffice_bot_user_link_source {
            channel_email channel_email
web_otp web_otp
        }
    


        backoffice_bot_message_direction {
            inbound inbound
outbound outbound
        }
    


        backoffice_bot_event_outbox_status {
            pending pending
sent sent
failed failed
        }
    


        backoffice_bot_outbound_delivery_status {
            processing processing
completed completed
        }
    


        backoffice_bot_ai_provider {
            groq groq
ollama ollama
        }
    


        backoffice_bot_ai_capability {
            intent_classification intent_classification
response_composition response_composition
clarification clarification
knowledge_answer knowledge_answer
transcription transcription
summarization summarization
evaluation evaluation
embedding embedding
provider_test provider_test
        }
    


        backoffice_bot_ai_interaction_status {
            shadowed shadowed
resolved resolved
clarification_needed clarification_needed
proposal_created proposal_created
confirmed confirmed
executed executed
cancelled cancelled
rejected rejected
fallback fallback
failed failed
        }
    


        backoffice_bot_ai_attempt_status {
            success success
validation_error validation_error
rate_limited rate_limited
timeout timeout
provider_error provider_error
circuit_open circuit_open
skipped skipped
        }
    


        backoffice_bot_ai_action_proposal_status {
            pending pending
confirmed confirmed
executed executed
cancelled cancelled
expired expired
rejected rejected
failed failed
        }
    


        backoffice_bot_ai_feedback_type {
            helpful helpful
unhelpful unhelpful
corrected corrected
confirmed confirmed
cancelled cancelled
        }
    


        backoffice_bot_host_ops_job_type {
            APPLY_ENV APPLY_ENV
RESTART_SERVICE RESTART_SERVICE
IMPORT_WORKFLOWS IMPORT_WORKFLOWS
SYNC_HOST SYNC_HOST
HEALTH HEALTH
        }
    


        backoffice_bot_host_ops_job_status {
            queued queued
running running
succeeded succeeded
failed failed
        }
    


        backoffice_bot_host_apply_status {
            never never
succeeded succeeded
failed failed
        }
    


        PublicFormStatus {
            draft draft
published published
archived archived
        }
    


        PublicFormApprovalStatus {
            draft draft
pending_approval pending_approval
approved approved
rejected rejected
        }
    


        PublicFormQuestionType {
            text text
textarea textarea
email email
phone phone
number number
currency currency
date date
url url
single_choice single_choice
multiple_choice multiple_choice
boolean boolean
health_plan health_plan
crm_field crm_field
custom_field custom_field
scheduling scheduling
consent consent
calculation calculation
        }
    


        PublicFormMappingTarget {
            native_field native_field
custom_field custom_field
notes notes
history history
        }
    


        PublicFormRuleOperator {
            equals equals
not_equals not_equals
contains contains
selected selected
not_selected not_selected
        }
    


        PublicFormRuleAction {
            show show
skip skip
jump_to jump_to
        }
    


        PublicFormSubmissionStatus {
            processing processing
completed completed
failed failed
        }
    


        PublicFormCompletionStatus {
            initial initial
partial partial
complete complete
        }
    


        PublicFormMetricType {
            form_viewed form_viewed
form_started form_started
question_viewed question_viewed
question_answered question_answered
question_skipped question_skipped
form_completed form_completed
lead_created lead_created
lead_attached lead_attached
lead_discarded lead_discarded
meeting_scheduled meeting_scheduled
page_viewed page_viewed
page_advanced page_advanced
page_returned page_returned
question_focused question_focused
form_submit_attempted form_submit_attempted
form_validation_failed form_validation_failed
form_submit_failed form_submit_failed
form_exit_intent form_exit_intent
form_abandoned form_abandoned
form_resumed form_resumed
        }
    


        public_form_journey_state {
            active active
abandoned abandoned
completed completed
        }
    


        backoffice_lead_extraction_status {
            PENDING PENDING
RUNNING RUNNING
DONE DONE
ERROR ERROR
        }
    


        backoffice_company_type {
            MEI MEI
ME ME
EPP EPP
EI EI
EIRELI EIRELI
SLU SLU
LTDA LTDA
SA SA
SS SS
OUTROS OUTROS
        }
    


        lead_document_request_status {
            pending pending
partially_filled partially_filled
completed completed
        }
    
  "corretor_studio_profiles" {
    String id "🗝️"
    String email 
    String supabaseId "❓"
    String fullName "❓"
    String phone "❓"
    String cpfCnpj "❓"
    String postalCode "❓"
    String address "❓"
    String addressNumber "❓"
    String neighborhood "❓"
    String complement "❓"
    String city "❓"
    String state "❓"
    String profileIconId "❓"
    String profileIconUrl "❓"
    UserRole role 
    UserFunction functions 
    Boolean isMaster 
    Boolean hasPermanentSubscription 
    Boolean hasUnlimitedUsers 
    Boolean multiskillEnabled 
    String asaasCustomerId "❓"
    AsaasAccount asaasCustomerAccount 
    String subscriptionId "❓"
    SubscriptionStatus subscriptionStatus "❓"
    SubscriptionPlan subscriptionPlan "❓"
    Int operatorCount 
    DateTime subscriptionStartDate "❓"
    DateTime subscriptionEndDate "❓"
    DateTime trialEndDate "❓"
    String asaasSubscriptionId "❓"
    AsaasAccount asaasSubscriptionAccount 
    DateTime subscriptionNextDueDate "❓"
    String subscriptionCycle "❓"
    String activeTeamId "❓"
    String timezone 
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_health_plan_options" {
    String id "🗝️"
    String name 
    String normalizedName 
    Boolean isActive 
    Boolean isDefault 
    String iconUrl "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime activatedAt "❓"
    DateTime deactivatedAt "❓"
    }
  

  "backoffice_users" {
    String id "🗝️"
    String email 
    Boolean fullAccess 
    Boolean isActive 
    Boolean isSdr 
    Boolean isCloser 
    String timezone 
    String mailboxStatus 
    String mailboxAddress "❓"
    DateTime mailboxProvisionedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_deletion_requests" {
    String id "🗝️"
    BackofficeDeletionRequestType type 
    String targetId 
    BackofficeDeletionRequestStatus status 
    String reason "❓"
    Json snapshot "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime executedAt "❓"
    }
  

  "backoffice_deletion_approvals" {
    String id "🗝️"
    BackofficeDeletionApprovalDecision decision 
    DateTime createdAt 
    }
  

  "backoffice_deletion_audit_logs" {
    String id "🗝️"
    BackofficeDeletionEntityType entityType 
    String entityId 
    String action 
    Json payload "❓"
    DateTime createdAt 
    }
  

  "backoffice_database_backups" {
    String id "🗝️"
    DateTime startedAt 
    DateTime finishedAt "❓"
    BackofficeDatabaseBackupStatus status 
    BackofficeDatabaseBackupSource source 
    String triggeredByProfileId "❓"
    String filePath "❓"
    String fileName "❓"
    BigInt sizeBytes "❓"
    String checksumSha256 "❓"
    String storageSyncPath "❓"
    String errorMessage "❓"
    String googleDriveFileId "❓"
    String googleDriveDownloadUrl "❓"
    DateTime createdAt 
    }
  

  "backoffice_banned_users" {
    String id "🗝️"
    String supabaseId "❓"
    String email 
    String fullName "❓"
    String reason "❓"
    BackofficeBanStatus status 
    BackofficeBanScope scope 
    DateTime bannedAt 
    DateTime liftedAt "❓"
    String liftReason "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_authorized_sponsors" {
    String id "🗝️"
    Boolean isActive 
    DateTime grantedAt 
    DateTime revokedAt "❓"
    String notes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_operational_access_grants" {
    String id "🗝️"
    BackofficeOperationalCapability capability 
    Boolean isActive 
    String notes "❓"
    DateTime grantedAt 
    DateTime revokedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_team_email_limit_grants" {
    String id "🗝️"
    Int maxEmailsPerDay "❓"
    Boolean isActive 
    String notes "❓"
    DateTime grantedAt 
    DateTime revokedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "google_oauth_connections" {
    String id "🗝️"
    String googleEmail 
    String accessToken "❓"
    String refreshToken "❓"
    DateTime tokenExpiresAt "❓"
    String scopes 
    DateTime lastRefreshedAt "❓"
    String lastRefreshError "❓"
    DateTime revokedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_clients" {
    String id "🗝️"
    String fullName 
    String email "❓"
    String phone "❓"
    String cpfCnpj "❓"
    String notes "❓"
    String asaasCustomerId "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_payments" {
    String id "🗝️"
    String asaasPaymentId "❓"
    AsaasAccount asaasAccount 
    String billingType 
    String status 
    Decimal amount 
    DateTime dueDate "❓"
    String description "❓"
    String invoiceUrl "❓"
    String pixQrCode "❓"
    String pixPayload "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_contracts" {
    String id "🗝️"
    String title 
    String description "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_contract_versions" {
    String id "🗝️"
    Int versionNumber 
    String fileName 
    String storagePath 
    Int fileSize 
    String fileType 
    DateTime importedAt 
    String shareTokenHash "❓"
    DateTime shareExpiresAt "❓"
    DateTime shareGeneratedAt "❓"
    }
  

  "backoffice_leads" {
    String id "🗝️"
    String name 
    String email "❓"
    String phone "❓"
    String cpfCnpj "❓"
    String notes "❓"
    BackofficeLeadStatus status 
    BackofficeLeadOrigin origin 
    String sourceExternalId "❓"
    DateTime meetingDate "❓"
    String meetingTitle "❓"
    String meetingNotes "❓"
    String meetingLink "❓"
    String meetingType "❓"
    String meetingExtraGuests 
    DateTime statusEnteredAt 
    DateTime createdAt 
    DateTime updatedAt 
    String qualification_lead_organization "❓"
    String qualification_avg_users "❓"
    String qualification_profile_fit "❓"
    }
  

  "backoffice_lead_offers" {
    String id "🗝️"
    String leadNameSnapshot 
    String contactName 
    String contactPhone 
    Json itemsJson 
    DateTime preContractExpiresAt 
    Decimal insuranceAmount "❓"
    String shareTokenHash 
    String tokenPlain "❓"
    DateTime shareExpiresAt 
    DateTime shareGeneratedAt 
    DateTime revokedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_adhesions" {
    String id "🗝️"
    String fullName 
    String phone 
    String email "❓"
    String cpfCnpj "❓"
    String postalCode "❓"
    String address "❓"
    String addressNumber "❓"
    String neighborhood "❓"
    String complement "❓"
    String city "❓"
    String state "❓"
    BackofficeAdhesionPlan plan 
    BackofficeAdhesionBillingCycle cycle 
    String modules 
    Int extraTeams 
    Int extraUsers 
    Decimal monthlyBaseAmount 
    Decimal monthlyExtraTeamsAmount 
    Decimal monthlyExtraUsersAmount 
    Decimal monthlyTotalAmount 
    Decimal totalAmount 
    String tokenHash 
    String tokenPreview 
    DateTime expiresAt 
    BackofficeAdhesionStatus status 
    String tokenPlain "❓"
    String asaasCustomerId "❓"
    String asaasPaymentId "❓"
    String asaasInstallmentId "❓"
    AsaasAccount asaasAccount 
    Decimal discountPercent "❓"
    String discountStatus "❓"
    DateTime discountApprovedAt "❓"
    Decimal negotiatedTotalAmount "❓"
    Int installmentCount "❓"
    String billingType "❓"
    DateTime paymentDueDate "❓"
    String invoiceUrl "❓"
    String bankSlipUrl "❓"
    String pixQrCode "❓"
    String pixPayload "❓"
    DateTime paidAt "❓"
    DateTime overdueAt "❓"
    DateTime canceledAt "❓"
    String createdProfileId "❓"
    String createdSupabaseId "❓"
    String requestedUserTypeSlug "❓"
    DateTime requestedMemberProAccessExpiresAt "❓"
    Boolean multiskillEnabled 
    Boolean hasUnlimitedUsers 
    Json additional_users_data 
    Json additional_teams_data 
    Json installmentSchedule 
    Json installmentLedger 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_leads_schedule" {
    String id "🗝️"
    DateTime date 
    String meetingTitle "❓"
    String notes "❓"
    String meetingLink "❓"
    String meetingType "❓"
    String extraGuests 
    String googleEventId "❓"
    String googleCalendarId "❓"
    BackofficeInviteDispatchStatus inviteDispatchStatus "❓"
    String inviteDispatchProvider "❓"
    Boolean inviteDispatchFallbackUsed 
    DateTime inviteDispatchLastAttemptAt "❓"
    String inviteDispatchLastError "❓"
    Json inviteDispatchLastPayload "❓"
    String publicShareTokenHash "❓"
    DateTime publicShareExpiresAt "❓"
    Boolean isCanceled 
    DateTime canceledAt "❓"
    String canceledByProfileId "❓"
    String cancelReason "❓"
    String createdByProfileId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_dispatches" {
    String id "🗝️"
    String recipientEmail 
    BackofficeEmailRecipientKind recipientKind 
    BackofficeEmailDispatchProvider provider 
    BackofficeEmailDispatchCategory category 
    String subject 
    BackofficeEmailDispatchStatus status 
    String resendEmailId "❓"
    String sourceType "❓"
    String sourceId "❓"
    String errorMessage "❓"
    DateTime sentAt "❓"
    DateTime deliveredAt "❓"
    DateTime openedAt "❓"
    DateTime clickedAt "❓"
    DateTime bouncedAt "❓"
    DateTime complainedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_dispatch_events" {
    String id "🗝️"
    BackofficeEmailDispatchEventType type 
    DateTime occurredAt 
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "backoffice_webhook_events" {
    String id "🗝️"
    BackofficeWebhookSource source 
    String eventType "❓"
    Json payload 
    String signature "❓"
    BackofficeWebhookEventStatus status 
    String errorMessage "❓"
    DateTime receivedAt 
    DateTime processedAt "❓"
    }
  

  "backoffice_webhook_tokens" {
    String id "🗝️"
    BackofficeWebhookSource source 
    String tokenHash 
    String tokenCipher 
    String tokenPreview 
    BackofficeWebhookTokenStatus status 
    BackofficeWebhookTokenExpiryMode expiryMode 
    DateTime expiresAt "❓"
    DateTime lastUsedAt "❓"
    String generatedByEmailSnapshot 
    DateTime generatedAt 
    DateTime updatedAt 
    }
  

  "backoffice_webhook_request_logs" {
    String id "🗝️"
    BackofficeWebhookSource source 
    String method 
    String endpoint 
    Int statusCode 
    String resultType 
    Json requestPayload "❓"
    Json responsePayload "❓"
    String errorMessage "❓"
    DateTime createdAt 
    }
  

  "backoffice_cron_executions" {
    String id "🗝️"
    String cronKey 
    String cronPath 
    BackofficeCronStatus status 
    DateTime startedAt 
    DateTime finishedAt "❓"
    Int durationMs "❓"
    String errorSummary "❓"
    String errorDetail "❓"
    Json metadata "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_contact_lists" {
    String id "🗝️"
    String name 
    Boolean isSystemDefault 
    Boolean isArchived 
    Int totalContacts 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_contacts" {
    String id "🗝️"
    String email 
    String name "❓"
    Json customFields "❓"
    Boolean isUnsubscribed 
    Boolean isBounced 
    Boolean isComplained 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_import_jobs" {
    String id "🗝️"
    BackofficeEmailImportSourceFormat sourceFormat 
    String rawContent 
    BackofficeEmailImportJobStatus status 
    Int totalRows 
    Int processedRows 
    Int importedCount 
    Int skippedCount 
    Int errorCount 
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_campaigns" {
    String id "🗝️"
    String name 
    BackofficeEmailCampaignType type 
    BackofficeEmailCampaignStatus status 
    String resendTemplateId "❓"
    String resendTemplateName "❓"
    String fromName "❓"
    String fromEmail "❓"
    String replyTo "❓"
    DateTime scheduledAt 
    DateTime sentAt "❓"
    Int totalRecipients 
    Int totalSent 
    Int totalDelivered 
    Int totalOpened 
    Int totalClicked 
    Int totalBounced 
    Int totalComplained 
    Int dispatchCount 
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_campaign_dispatches" {
    String id "🗝️"
    Int dispatchNumber 
    String templateSubjectSnapshot 
    String templateHtmlSnapshot 
    String resendTemplateIdSnapshot "❓"
    BackofficeEmailCampaignDispatchStatus status 
    Int totalRecipients 
    Int totalSent 
    Int totalDelivered 
    Int totalOpened 
    Int totalClicked 
    Int totalBounced 
    Int totalComplained 
    String triggeredByBackofficeUserId "❓"
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_logs" {
    String id "🗝️"
    String recipientEmail 
    String resendEmailId "❓"
    BackofficeEmailLogStatus status 
    DateTime sentAt "❓"
    DateTime deliveredAt "❓"
    DateTime openedAt "❓"
    DateTime clickedAt "❓"
    DateTime bouncedAt "❓"
    DateTime complainedAt "❓"
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_email_events" {
    String id "🗝️"
    BackofficeEmailEventType type 
    DateTime occurredAt 
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "backoffice_email_orphan_events" {
    String id "🗝️"
    String resendEmailId 
    String resendEventType 
    DateTime occurredAt 
    Json tagsHint "❓"
    BackofficeEmailOrphanEventStatus status 
    Int attempts 
    String lastError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_leads" {
    String id "🗝️"
    String leadCode 
    LeadStatus status "❓"
    String name 
    String email "❓"
    String phone "❓"
    String cnpj "❓"
    String razaoSocial "❓"
    String age "❓"
    String currentHealthPlan "❓"
    Decimal currentValue "❓"
    String referenceHospital "❓"
    String currentTreatment "❓"
    DateTime meetingDate "❓"
    String meetingTitle "❓"
    String meetingNotes "❓"
    String meetingLink "❓"
    MeetingHeald meetingHeald "❓"
    Boolean meetingPresenceConfirmed 
    DateTime meetingPresenceConfirmedAt "❓"
    String meetingType "❓"
    Boolean isTransfer 
    DateTime followUpAt "❓"
    String followUpNotes "❓"
    LeadStatus followUpSourceStatus "❓"
    String lossReason "❓"
    String lossReasonDetails "❓"
    DateTime statusEnteredAt 
    String notes "❓"
    Decimal ticket "❓"
    DateTime contractDueDate "❓"
    String soldPlan "❓"
    Boolean isReferral "❓"
    String referrerName "❓"
    String referrerPhone "❓"
    LeadOriginChannel originChannel "❓"
    Json originMetadata "❓"
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_activities" {
    String id "🗝️"
    ActivityType type 
    String body "❓"
    Json payload "❓"
    DateTime createdAt 
    String outcome "❓"
    Int duration "❓"
    DateTime contactDate "❓"
    String contactTime "❓"
    }
  

  "corretor_studio_lead_activity_reactions" {
    String id "🗝️"
    String emoji 
    String emojiUnified 
    DateTime createdAt 
    }
  

  "corretor_studio_audit_logs" {
    String id "🗝️"
    AuditEntityType entityType 
    String entityId 
    AuditAction action 
    Json before "❓"
    Json after "❓"
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_tasks" {
    String id "🗝️"
    String title 
    TaskType taskType 
    String body 
    Boolean isUrgent 
    DateTime startAt "❓"
    DateTime endAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_task_assignees" {
    String id "🗝️"
    TaskAssigneeStatus status 
    String googleEventId "❓"
    String googleCalendarId "❓"
    Boolean googleSynced 
    DateTime assignedAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_leads_schedule" {
    String id "🗝️"
    DateTime date 
    Int noShowCount 
    String meetingTitle "❓"
    String notes "❓"
    String meetingLink "❓"
    String meetingType "❓"
    String extraGuests 
    String googleEventId "❓"
    String googleCalendarId "❓"
    InviteDispatchStatus inviteDispatchStatus "❓"
    Boolean inviteDispatchFallbackUsed 
    DateTime inviteDispatchLastAttemptAt "❓"
    String inviteDispatchLastError "❓"
    Json inviteDispatchLastPayload "❓"
    String publicShareTokenHash "❓"
    DateTime publicShareExpiresAt "❓"
    DateTime reminder30MinSentAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_finalized" {
    String id "🗝️"
    DateTime finalizedDateAt 
    DateTime startDateAt 
    Int duration 
    Decimal amount 
    ContractType contractType 
    String notes "❓"
    String operadora "❓"
    String productName "❓"
    String contractFileUrl "❓"
    String contractStoragePath "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_finalized_holders" {
    String id "🗝️"
    String name 
    String razaoSocial "❓"
    DateTime birthDate 
    String document 
    String cnpj "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_finalized_dependents" {
    String id "🗝️"
    String name 
    DateTime birthDate 
    String parentesco 
    String document "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_portfolio" {
    String id "🗝️"
    PortfolioStatus portfolioStatus 
    RenewalStatus renewalStatus 
    Decimal renewalAmount "❓"
    PortfolioSource source 
    String note "❓"
    DateTime lastContactAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_attachments" {
    String id "🗝️"
    String fileName 
    String fileUrl 
    String storagePath 
    String fileType 
    Int fileSize 
    DateTime uploadedAt 
    }
  

  "corretor_studio_lead_proposal_reviews" {
    String id "🗝️"
    LeadProposalReviewStatus status 
    String criticizedTitle "❓"
    String criticizedMessage "❓"
    DateTime criticizedAt "❓"
    DateTime saleRegisteredAt "❓"
    Json salePayload "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_required_documents" {
    String id "🗝️"
    LeadRequiredDocumentType documentType 
    LeadRequiredDocumentStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_pending_operators" {
    String id "🗝️"
    String name 
    String email 
    String role 
    UserFunction functions 
    String paymentId "❓"
    String subscriptionId "❓"
    String paymentStatus 
    String paymentMethod 
    Boolean operatorCreated 
    String operatorId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_teams" {
    String id "🗝️"
    String name 
    Boolean isDefault 
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_filter_presets" {
    String id "🗝️"
    String name 
    String description "❓"
    Json queryJson 
    FilterPresetScope scope 
    FilterPresetVisibility visibility 
    DateTime lastUsedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_status_rules" {
    String id "🗝️"
    TeamStatusRuleType type 
    LeadStatus targetStatus 
    LeadStatus requiredStatus "❓"
    Int leadTimeValue "❓"
    TeamLeadTimeUnit leadTimeUnit "❓"
    Boolean requireConfirmation 
    String confirmationMessage "❓"
    Boolean isEnabled 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_custom_field_definitions" {
    String id "🗝️"
    String key 
    String label 
    LeadCustomFieldType type 
    Json options "❓"
    Boolean isRequired 
    Int displayOrder 
    Boolean isActive 
    Boolean showOnPublicForm 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_custom_field_values" {
    String id "🗝️"
    Json value 
    DateTime updatedAt 
    DateTime createdAt 
    }
  

  "corretor_studio_team_automation_rules" {
    String id "🗝️"
    String name 
    String description "❓"
    TeamAutomationTriggerType triggerType 
    Json triggerConfig 
    TeamAutomationActionType actionType 
    Json actionConfig 
    Boolean isEnabled 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_automation_run_logs" {
    String id "🗝️"
    String leadId "❓"
    String dedupeKey 
    TeamAutomationRunStatus status 
    String errorMessage "❓"
    Json payload "❓"
    DateTime executedAt 
    }
  

  "corretor_studio_team_studio_webhook_configs" {
    String id "🗝️"
    String tokenHash 
    String tokenCipher "❓"
    String tokenPreview 
    StudioWebhookTokenExpiryMode expiryMode 
    DateTime expiresAt "❓"
    DateTime lastUsedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_studio_webhook_request_logs" {
    String id "🗝️"
    String method 
    String endpoint 
    Int statusCode 
    String resultType 
    Json requestPayload "❓"
    Json responsePayload "❓"
    String errorMessage "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_team_radar_pixel_configs" {
    String id "🗝️"
    String publicToken 
    String allowedOrigins 
    DateTime lastUsedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_radar_pixel_hit_logs" {
    String id "🗝️"
    String eventType 
    String visitorSession 
    String origin "❓"
    String userAgent "❓"
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_team_webhooks" {
    String id "🗝️"
    TeamWebhookDirection direction 
    TeamWebhookStatus status 
    String name 
    String targetUrl "❓"
    TeamWebhookDestinationPreset destinationPreset "❓"
    TeamWebhookEventKey selectedEvents 
    Int failureStreak 
    Int failureThreshold 
    DateTime pausedAt "❓"
    String pauseReason "❓"
    String tokenHash "❓"
    String tokenCipher "❓"
    String tokenPreview "❓"
    StudioWebhookTokenExpiryMode expiryMode "❓"
    DateTime expiresAt "❓"
    DateTime lastUsedAt "❓"
    DateTime lastSuccessAt "❓"
    DateTime lastFailureAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_webhook_event_logs" {
    String id "🗝️"
    TeamWebhookDirection direction 
    TeamWebhookLogResult result 
    TeamWebhookEventKey eventKey "❓"
    String method "❓"
    String endpoint "❓"
    Int statusCode "❓"
    Json requestPayload "❓"
    Json responsePayload "❓"
    String errorMessage "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_team_webhook_outbox" {
    String id "🗝️"
    TeamWebhookEventKey eventKey 
    Json payload 
    TeamWebhookOutboxStatus status 
    Int attemptCount 
    DateTime nextAttemptAt 
    String lastError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_notifications" {
    String id "🗝️"
    NotificationType type 
    String message 
    Json metadata "❓"
    Boolean isRead 
    DateTime readAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "meeting_follow_up_digest_logs" {
    String id "🗝️"
    DateTime digestDate 
    DateTime sentAt 
    Int leadCount 
    String channel 
    DateTime createdAt 
    }
  

  "corretor_studio_profile_web_push_subscriptions" {
    String id "🗝️"
    String endpoint 
    String p256dh 
    String auth 
    String userAgent "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_profile_web_push_consents" {
    String id "🗝️"
    WebPushConsentStatus status 
    String consentVersion 
    DateTime consentedAt "❓"
    DateTime declinedAt "❓"
    DateTime dismissedAt "❓"
    String source "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_platform_purchases" {
    String id "🗝️"
    String profile_id 
    String team_id "❓"
    String product_slug 
    PlatformPurchaseType purchase_type 
    PlatformPurchaseStatus status 
    String billing_type "❓"
    Decimal amount 
    Int quantity "❓"
    String description "❓"
    Json metadata "❓"
    String asaas_payment_id "❓"
    AsaasAccount asaas_account 
    String asaas_customer_id "❓"
    String external_reference 
    DateTime paid_at "❓"
    DateTime applied_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "corretor_studio_asaas_notification_backfill" {
    String asaas_customer_id "🗝️"
    AsaasNotificationBackfillStatus status 
    String last_error "❓"
    DateTime completed_at "❓"
    DateTime created_at 
    DateTime updated_at 
    }
  

  "corretor_studio_pending_actions" {
    String id "🗝️"
    PendingActionType actionType 
    PendingActionStatus status 
    Json payload 
    String checkoutId "❓"
    String paymentId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_members" {
    String id "🗝️"
    UserRole role 
    UserFunction functions 
    Boolean canCreateAccountUsers 
    Boolean canManageAccountTeams 
    Boolean canTransferAccountLeads 
    Boolean canViewAllTeams 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_transfer_routes" {
    String id "🗝️"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_transfers" {
    String id "🗝️"
    String fromManagerId 
    String toManagerId 
    Boolean transferTagUsed 
    DateTime preScheduledAt "❓"
    Boolean scheduledAtTransfer 
    DateTime createdAt 
    }
  

  "corretor_studio_email_credit_subscriptions" {
    String id "🗝️"
    EmailCreditPlan plan 
    Int monthlyCredits 
    EmailCreditSubscriptionStatus status 
    DateTime currentPeriodStart 
    DateTime currentPeriodEnd 
    DateTime canceledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_credit_payment_grants" {
    String id "🗝️"
    String teamId 
    EmailCreditPlan plan 
    String paymentId 
    AsaasAccount asaasAccount 
    String checkoutId "❓"
    Int monthlyCredits 
    DateTime createdAt 
    }
  

  "corretor_studio_email_credit_usages" {
    String id "🗝️"
    DateTime periodStart 
    DateTime periodEnd 
    Int creditsUsed 
    Int overageCount 
    Decimal overageCharged 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_email_campaign_limit_grants" {
    String id "🗝️"
    Int maxEmailsPerDay "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_templates" {
    String id "🗝️"
    String name 
    String subject 
    String previewText "❓"
    Json mailyJson "❓"
    String html "❓"
    String editorMode 
    Json variables "❓"
    Int versionNumber 
    Boolean isCurrentPublished 
    String status 
    DateTime publishedAt "❓"
    Boolean isArchived 
    String approvalStatus 
    DateTime approvedAt "❓"
    DateTime rejectedAt "❓"
    String reviewNote "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_template_history" {
    String id "🗝️"
    String eventType 
    String description "❓"
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_email_contact_lists" {
    String id "🗝️"
    String name 
    String description "❓"
    String csvStoragePath "❓"
    Int totalContacts 
    Boolean isSystemDefault 
    Boolean isBlocklist 
    Boolean isArchived 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_import_jobs" {
    String id "🗝️"
    String importId 
    String sourceFormat 
    String storagePath 
    String status 
    Int totalRows 
    Int processedRows 
    Int importedCount 
    Int updatedCount 
    Int skippedCount 
    Json skippedIssues "❓"
    Json failedBatches "❓"
    Int batchSize 
    Json attemptsByBatch "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_contacts" {
    String id "🗝️"
    String email 
    String name "❓"
    Json customFields "❓"
    Boolean isUnsubscribed 
    Boolean isBounced 
    Boolean isComplained 
    String blockReason "❓"
    DateTime blockedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_contact_radar_sync_outbox" {
    String id "🗝️"
    EmailContactRadarSyncOutboxStatus status 
    Int generation 
    Int attemptCount 
    DateTime nextAttemptAt 
    String lastError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_campaigns" {
    String id "🗝️"
    String name 
    String description "❓"
    String radarSegmentSlug "❓"
    Int subCampaignIndex "❓"
    String audienceContactIds 
    String source_contact_list_ids 
    EmailCampaignStatus status 
    DateTime scheduledAt "❓"
    DateTime sentAt "❓"
    Int totalRecipients 
    Int totalSent 
    Int totalDelivered 
    Int totalOpened 
    Int totalClicked 
    Int totalBounced 
    Int dispatchCount 
    Int totalComplained 
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_campaign_dispatches" {
    String id "🗝️"
    Int dispatchNumber 
    Int templateVersionNumber 
    String templateName 
    String templateSubject 
    String templateHtml 
    String contactListName "❓"
    String radarSegmentSlug "❓"
    DateTime dispatchedAt 
    Int totalRecipients 
    Int totalSent 
    Int totalDelivered 
    Int totalOpened 
    Int totalClicked 
    Int totalBounced 
    Int totalComplained 
    EmailCampaignDispatchStatus status 
    EmailCampaignBatchIdempotencyScheme batchIdempotencyScheme 
    Boolean retryFailedOnly 
    Int reservedCredits 
    Boolean hasCampaignsBetaAccess 
    Int materializeSourceOffset 
    String errorMessage "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_logs" {
    String id "🗝️"
    String resendEmailId "❓"
    String recipientEmail 
    String recipientName "❓"
    String subject 
    EmailLogCategory category 
    String sourceType "❓"
    String sourceId "❓"
    EmailLogStatus status 
    DateTime sentAt "❓"
    DateTime deliveredAt "❓"
    DateTime openedAt "❓"
    DateTime clickedAt "❓"
    DateTime bouncedAt "❓"
    DateTime complainedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_events" {
    String id "🗝️"
    EmailEventType type 
    DateTime occurredAt 
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "email_orphan_events" {
    String id "🗝️"
    String resendEmailId 
    String resendEventType 
    DateTime occurredAt 
    Json tagsHint "❓"
    EmailOrphanEventStatus status 
    Int attempts 
    String lastError "❓"
    DateTime processedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_resend_webhook_processing_failures" {
    String id "🗝️"
    String svixId 
    String eventType 
    Json payload 
    ResendWebhookProcessingFailureStatus status 
    Int attemptCount 
    DateTime nextAttemptAt 
    String lastError "❓"
    String failureReason "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_queue_event_failures" {
    String id "🗝️"
    PublicFormQueueEventKind kind 
    String idempotencyKey 
    Json payload 
    PublicFormQueueEventFailureStatus status 
    Int attemptCount 
    DateTime nextAttemptAt 
    String lastError "❓"
    String failureReason "❓"
    String eventId "❓"
    Int schemaVersion "❓"
    String topic "❓"
    String failureStage "❓"
    String lastErrorCode "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_queue_processing_failures" {
    String id "🗝️"
    String topic 
    String idempotencyKey 
    Json payload 
    QueueProcessingFailureStatus status 
    Int attemptCount 
    DateTime nextAttemptAt 
    String lastError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_products" {
    String id "🗝️"
    String name 
    String featureSlugs 
    String description "❓"
    BackofficeProductType type 
    BackofficeProductBillingMode billingMode 
    Decimal priceMonthly "❓"
    Decimal priceQuarterly "❓"
    Decimal priceQuadrimester "❓"
    Decimal priceSemiannual "❓"
    Decimal priceAnnual "❓"
    Decimal priceLifetime "❓"
    Boolean isDefault 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_features" {
    String id "🗝️"
    String slug 
    String name 
    String description "❓"
    String productSlug "❓"
    BackofficeFeatureAccessMode accessMode 
    BackofficeFeatureAccessLevel defaultAccessLevel 
    Boolean betaEnabled 
    Boolean charge_during_beta 
    Boolean inheritParentSettings 
    Boolean billedSeparately 
    Boolean isActive 
    Int sortOrder 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_feature_access_rules" {
    String id "🗝️"
    BackofficeAccessPrincipal principal 
    BackofficeFeatureAccessLevel accessLevel 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_feature_grants" {
    String id "🗝️"
    BackofficeFeatureGrantType grantType 
    BackofficeFeatureAccessLevel accessLevel 
    BackofficeBetaTeamScope betaTeamScope 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_feature_grant_teams" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "backoffice_product_payment_rules" {
    String id "🗝️"
    BackofficePaymentMethod paymentMethod 
    BackofficeAdhesionBillingCycle billingCycle 
    Decimal price 
    Boolean canInstallment 
    Int maxInstallments 
    InstallmentSplitMode installmentSplitMode 
    Json installmentSchedule 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_lead_status_transition_field_rules" {
    String id "🗝️"
    LeadStatus targetStatus 
    BackofficeLeadTransitionFieldKey fieldKey 
    Boolean isEnabled 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_lead_status_transition_gates" {
    String id "🗝️"
    String slug 
    String name 
    BackofficeLeadTransitionGateType gateType 
    LeadStatus sourceStatus "❓"
    LeadStatus targetStatus "❓"
    Json config 
    String blockerType 
    String errorMessage "❓"
    Boolean isEnabled 
    Int sortOrder 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_crm_lead_status_transition_gates" {
    String id "🗝️"
    String slug 
    String name 
    BackofficeLeadTransitionGateType gateType 
    BackofficeLeadStatus sourceStatus "❓"
    BackofficeLeadStatus targetStatus "❓"
    Json config 
    String blockerType 
    String errorMessage "❓"
    Boolean isEnabled 
    Int sortOrder 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_radar_engagement_weights" {
    String id "🗝️"
    String eventType 
    Int weight 
    String description "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_radar_engagement_configs" {
    String id "🗝️"
    Int windowRecentDays 
    Int windowMidDays 
    Int windowOldDays 
    Float recentMultiplier 
    Float oldMultiplier 
    Int hotThreshold 
    Int warmThreshold 
    Int lukewarmThreshold 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_radar_outbox_throughput_configs" {
    String id "🗝️"
    Int batchSize 
    Int concurrency 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_form_engagement_score_rules" {
    String id "🗝️"
    Int minPercent 
    Int maxPercent 
    Float multiplier 
    String label 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_crm_lead_status_transition_field_rules" {
    String id "🗝️"
    BackofficeLeadStatus targetStatus 
    BackofficeLeadTransitionFieldKey fieldKey 
    Boolean isEnabled 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_user_subscriptions" {
    String id "🗝️"
    BackofficeSubscriptionStatus status 
    BackofficeAdhesionBillingCycle cycle "❓"
    DateTime startDate 
    DateTime endDate "❓"
    String adhesionId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_profile_subscriptions" {
    String id "🗝️"
    String asaasSubscriptionId "❓"
    String asaasInstallmentId "❓"
    SubscriptionStatus subscriptionStatus "❓"
    SubscriptionPlan subscriptionPlan "❓"
    DateTime subscriptionStartDate "❓"
    DateTime subscriptionEndDate "❓"
    DateTime trialEndDate "❓"
    DateTime subscriptionNextDueDate "❓"
    String subscriptionCycle "❓"
    DateTime subscriptionLastSyncedAt "❓"
    Boolean hasPermanentSubscription 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_subscription_change_logs" {
    String id "🗝️"
    String source 
    String changeType 
    Json before "❓"
    Json after "❓"
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_profile_subscription_capacities" {
    String id "🗝️"
    Int includedExtraTeams 
    Int includedExtraUsers 
    Int manualAdjustmentExtraTeams 
    Int manualAdjustmentExtraUsers 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "email_team_settings" {
    String id "🗝️"
    String fromName 
    String fromEmail 
    String replyTo "❓"
    Json dispatchBlockedDates "❓"
    String dispatchTimeFrom "❓"
    String dispatchTimeTo "❓"
    String dispatchAllowedRoles 
    String templateCreateRoles 
    Boolean templateApprovalRequired 
    String templateApprovalRoles 
    Int blockedDispatchDays 
    String resendDomainId "❓"
    String resendDomainName "❓"
    String resendDomainStatus "❓"
    String resendDomainRegion "❓"
    DateTime resendDomainConnectedAt "❓"
    Boolean resendOpenTracking 
    Boolean resendClickTracking 
    Boolean resendSendingDnsVerified 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_team_domain_events" {
    String id "🗝️"
    String type 
    DateTime occurredAt 
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "email_team_senders" {
    String id "🗝️"
    String name 
    String email 
    String replyTo "❓"
    Boolean isDefault 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "email_team_variables" {
    String id "🗝️"
    String key 
    String type 
    String defaultValue "❓"
    String description "❓"
    Boolean isActive 
    EmailVariableValueSource valueSource 
    String radarFieldKey "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "profile_user_types" {
    String id "🗝️"
    String slug 
    String name 
    String description "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "profile_user_type_assignments" {
    String id "🗝️"
    DateTime accessStartsAt "❓"
    DateTime accessExpiresAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "team_whatsapp_contacts" {
    String id "🗝️"
    String remoteJid 
    String opaqueId 
    String phoneNumber "❓"
    String displayName "❓"
    String pushName "❓"
    TeamWhatsAppContactSource source 
    String phoneE164 "❓"
    String name "❓"
    WhatsAppContactNameSource nameSource 
    String searchText "❓"
    WhatsAppContactSyncState syncState 
    DateTime lastSeenAt "❓"
    DateTime lastSyncedAt 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_contact_identities" {
    String id "🗝️"
    String remoteJid 
    String identityType 
    String phoneE164 "❓"
    String mappingSource 
    DateTime verifiedAt "❓"
    Boolean sendable 
    DateTime firstSeenAt 
    DateTime lastSeenAt 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "team_whatsapp_configs" {
    String id "🗝️"
    WhatsAppProvider provider 
    WhatsAppEngine engine 
    String instanceName 
    String instanceId "❓"
    String phoneNumber "❓"
    String normalizedPhone "❓"
    String lastConnectedNormalizedPhone "❓"
    String displayName "❓"
    WhatsAppConnectionStatus status 
    String qrCodeText "❓"
    String qrCodeImageUrl "❓"
    String webhookSecret 
    DateTime lastConnectedAt "❓"
    DateTime lastDisconnectedAt "❓"
    DateTime lastSyncAt "❓"
    WhatsAppHistorySyncStatus historySyncStatus 
    DateTime historySyncStartedAt "❓"
    DateTime historySyncCompletedAt "❓"
    String historySyncError "❓"
    Int usageLimitMonthly 
    Boolean billingEnabled 
    Int webhookConsecutiveFailures 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_conversations" {
    String id "🗝️"
    String externalChatId "❓"
    String contactPhone 
    String contactName "❓"
    WhatsAppContactNameSource contactNameSource 
    String contactAvatarUrl "❓"
    String normalizedPhone 
    DateTime lastMessageAt "❓"
    DateTime lastInboundAt "❓"
    DateTime lastOutboundAt "❓"
    String lastMessagePreview "❓"
    Int unreadCount 
    Boolean isArchived 
    WhatsAppHandoffMode handoffMode 
    DateTime welcomeSentAt "❓"
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_messages" {
    String id "🗝️"
    String providerMessageId "❓"
    String providerEventId "❓"
    String clientMessageId "❓"
    WhatsAppMessageDirection direction 
    WhatsAppMessageType messageType 
    WhatsAppMessageStatus status 
    String contentText "❓"
    String mediaUrl "❓"
    String mediaMimeType "❓"
    String mediaFileName "❓"
    Json linkPreview "❓"
    String caption "❓"
    String senderDisplayName "❓"
    String senderPhone "❓"
    String recipientPhone "❓"
    DateTime sentAt "❓"
    DateTime deliveredAt "❓"
    DateTime readAt "❓"
    DateTime playedAt "❓"
    DateTime failedAt "❓"
    Boolean isAutoResponse 
    BigInt providerTimestamp "❓"
    Json rawPayload 
    String storagePath "❓"
    String mediaSha256 "❓"
    Int mediaSizeBytes "❓"
    Int mediaDurationMs "❓"
    WhatsAppMediaStatus mediaStatus "❓"
    Int mediaAttemptCount 
    String mediaLastErrorCode "❓"
    DateTime mediaRetrievedAt "❓"
    String quotedProviderMessageId "❓"
    DateTime deletedForEveryoneAt "❓"
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_message_reactions" {
    String id "🗝️"
    String actorPhone "❓"
    String emoji 
    String providerReactionId "❓"
    DateTime removedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_message_favorites" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "whatsapp_message_pins" {
    String id "🗝️"
    DateTime pinnedAt 
    DateTime expiresAt "❓"
    DateTime removedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_message_visibility" {
    String id "🗝️"
    DateTime hiddenAt 
    }
  

  "whatsapp_message_action_commands" {
    String id "🗝️"
    String clientActionId 
    WhatsAppMessageActionCommandKind kind 
    WhatsAppMessageActionCommandStatus status 
    String requestHash "❓"
    String emoji "❓"
    Int attemptCount 
    DateTime claimedAt "❓"
    String lastError "❓"
    DateTime reconciledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_outbound_commands" {
    String id "🗝️"
    String clientMessageId 
    String messageId "❓"
    WhatsAppOutboundCommandStatus status 
    Int attemptCount 
    String requestHash "❓"
    DateTime claimedAt "❓"
    DateTime nextReconcileAt "❓"
    String lastError "❓"
    DateTime reconciledAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_sync_jobs" {
    String id "🗝️"
    String status 
    Json checkpoint 
    String leaseOwner "❓"
    DateTime leaseExpiresAt "❓"
    DateTime startedAt "❓"
    DateTime completedAt "❓"
    String lastError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_webhook_events" {
    String id "🗝️"
    String providerEventId "❓"
    String eventType 
    Json payload 
    WhatsAppWebhookEventStatus status 
    Int attemptCount 
    String lastError "❓"
    DateTime nextAttemptAt "❓"
    DateTime processingStartedAt "❓"
    DateTime processedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_audit_events" {
    String id "🗝️"
    String action 
    Json metadata 
    DateTime createdAt 
    }
  

  "whatsapp_usage_events" {
    String id "🗝️"
    String conversationId "❓"
    String messageId "❓"
    String providerMessageId "❓"
    String periodKey 
    WhatsAppProvider provider 
    WhatsAppUsageEventType eventType 
    WhatsAppMessageDirection direction "❓"
    Boolean billable 
    Boolean countedTowardsQuota 
    Int quantity 
    Json rawPayload "❓"
    DateTime createdAt 
    }
  

  "whatsapp_send_rate_limit_windows" {
    DateTime windowStart "🗝️"
    Int count 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_auto_response_rules" {
    String id "🗝️"
    WhatsAppAutoResponseRuleType type 
    String replyMessage 
    String triggerKeywords 
    WhatsAppAutoResponseMatchMode matchMode 
    Json offHoursSchedule "❓"
    Boolean isActive 
    Int priority 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_auto_response_logs" {
    String id "🗝️"
    WhatsAppAutoResponseRuleType ruleType 
    String inboundMessageId "❓"
    String outboundMessageId "❓"
    String triggerText "❓"
    String sentText 
    DateTime createdAt 
    }
  

  "whatsapp_conversation_tags" {
    String id "🗝️"
    String name 
    String color 
    Int sortOrder 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "whatsapp_conversation_tag_assignments" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "corretor_studio_radar_profiles" {
    String id "🗝️"
    String normalizedName 
    String displayName 
    String normalizedPhone "❓"
    String displayPhone "❓"
    String primaryEmail "❓"
    String normalizedPrimaryEmail "❓"
    String primaryDocument "❓"
    String normalizedPrimaryDocument "❓"
    DateTime lastSeenAt "❓"
    Json profileData "❓"
    Int engagementScore "❓"
    String engagementBand "❓"
    String gender "❓"
    String genderSource "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_radar_identities" {
    String id "🗝️"
    RadarIdentityType type 
    String value "❓"
    String normalizedValue 
    String source 
    Boolean isPrimary 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_radar_source_links" {
    String id "🗝️"
    RadarSourceType sourceType 
    String sourceId 
    Json sourceMetadata "❓"
    DateTime firstLinkedAt 
    DateTime lastSyncedAt 
    }
  

  "corretor_studio_radar_events" {
    String id "🗝️"
    String eventType 
    String sourceType 
    String sourceId "❓"
    DateTime occurredAt 
    Json metadata "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_radar_channel_consents" {
    String id "🗝️"
    RadarChannel channel 
    RadarConsentStatus status 
    RadarConsentReason reason "❓"
    String sourceType "❓"
    String sourceId "❓"
    DateTime updatedAt 
    DateTime createdAt 
    }
  

  "corretor_studio_radar_pixel_rate_limits" {
    String key "🗝️"
    Int count 
    DateTime resetAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_radar_segments" {
    String id "🗝️"
    String name 
    String description "❓"
    Json rulesJson 
    Boolean isSystem 
    Boolean isActive 
    SegmentSourceType sourceType 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_radar_field_definitions" {
    String id "🗝️"
    String key 
    String label 
    String valueType 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_radar_import_jobs" {
    String id "🗝️"
    String importId 
    String baseName 
    String sourceFormat 
    String storagePath 
    Json fieldMapping 
    String status 
    Int totalRows 
    Int processedRows 
    Int createdCount 
    Int enrichedCount 
    Int skippedCount 
    Int deferredCount 
    Json skippedIssues "❓"
    Json failedBatches "❓"
    Int batchSize 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_channels" {
    String id "🗝️"
    String displayName 
    String avatarUrl "❓"
    String avatarStoragePath "❓"
    String aboutText "❓"
    String phoneNumber "❓"
    DateTime lastProfileSyncAt "❓"
    BackofficeBotChannelType channelType 
    BackofficeBotChannelStatus status 
    Json providerConfig "❓"
    String webhookSecret 
    String n8nInboundUrl "❓"
    String n8nOutboundSecret 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_auth_challenges" {
    String id "🗝️"
    BackofficeBotAuthChallengeSource source 
    String normalizedPhone "❓"
    String emailRequested "❓"
    String codeHash 
    BackofficeBotAuthChallengeStatus status 
    Int attemptCount 
    DateTime expiresAt 
    DateTime verifiedAt "❓"
    Json ipMetadata "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_user_links" {
    String id "🗝️"
    String normalizedPhone 
    DateTime linkedAt 
    BackofficeBotUserLinkSource linkedBy 
    Boolean isActive 
    DateTime lastInteractionAt "❓"
    DateTime revokedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_sessions" {
    String id "🗝️"
    String currentLeadId "❓"
    String flowId "❓"
    String flowStep "❓"
    Json flowStack 
    DateTime expiresAt 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_messages" {
    String id "🗝️"
    BackofficeBotMessageDirection direction 
    String channelMessageId "❓"
    String flowId "❓"
    String errorCode "❓"
    Json payload 
    DateTime createdAt 
    }
  

  "backoffice_bot_notification_preferences" {
    String id "🗝️"
    String type 
    Boolean enabled 
    Json quietHours "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_event_outbox" {
    String id "🗝️"
    String eventType 
    Json payload 
    BackofficeBotEventOutboxStatus status 
    String idempotencyKey 
    Int attemptCount 
    DateTime nextAttemptAt "❓"
    String lastError "❓"
    DateTime createdAt 
    DateTime sentAt "❓"
    }
  

  "backoffice_bot_outbound_delivery" {
    String id "🗝️"
    String idempotencyKey 
    BackofficeBotOutboundDeliveryStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_ai_configurations" {
    Boolean id "🗝️"
    Boolean enabled 
    Boolean shadowMode 
    Int rolloutPercentage 
    BackofficeBotAiProvider primaryProvider 
    String primaryModel 
    String fallbackModel "❓"
    Float confidenceThreshold 
    Int dailyUserLimit 
    Int dailyGlobalLimit 
    Int timeoutMs 
    Int circuitBreakerFailureThreshold 
    Int circuitBreakerResetSeconds 
    Int retentionDays 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_ai_interactions" {
    String id "🗝️"
    String sessionId "❓"
    String teamIdSnapshot "❓"
    BackofficeBotAiCapability capability 
    BackofficeBotAiInteractionStatus status 
    String intent "❓"
    Float confidence "❓"
    String promptKey "❓"
    String promptVersion 
    Boolean isShadow 
    Boolean usedFallback 
    String inputHash "❓"
    String outputHash "❓"
    String errorCode "❓"
    Int latencyMs "❓"
    DateTime createdAt 
    }
  

  "backoffice_bot_ai_attempts" {
    String id "🗝️"
    Int sequence 
    BackofficeBotAiProvider provider 
    String model 
    BackofficeBotAiCapability capability 
    BackofficeBotAiAttemptStatus status 
    Int inputTokens "❓"
    Int outputTokens "❓"
    Int totalTokens "❓"
    Float estimatedCostUsd "❓"
    Int latencyMs "❓"
    Int httpStatus "❓"
    String errorCode "❓"
    String providerRequestId "❓"
    String requestSchemaVersion "❓"
    String responseSchemaVersion "❓"
    DateTime createdAt 
    }
  

  "backoffice_bot_ai_proposals" {
    String id "🗝️"
    String teamIdSnapshot "❓"
    String action 
    String paramsSummary 
    String paramsCiphertext 
    String encryptionKeyVersion 
    String confirmationMessage "❓"
    BackofficeBotAiActionProposalStatus status 
    String idempotencyKey 
    DateTime expiresAt 
    DateTime confirmedAt "❓"
    DateTime executedAt "❓"
    String resultCode "❓"
    DateTime createdAt 
    }
  

  "backoffice_bot_ai_feedback" {
    String id "🗝️"
    BackofficeBotAiFeedbackType type 
    String correctedIntent "❓"
    String origin 
    DateTime createdAt 
    }
  

  "backoffice_bot_ai_daily_usage" {
    DateTime day "🗝️"
    BackofficeBotAiProvider provider "🗝️"
    String model "🗝️"
    BackofficeBotAiCapability capability "🗝️"
    Int requests 
    Int successes 
    Int failures 
    Int fallbacks 
    BigInt inputTokens 
    BigInt outputTokens 
    Float estimatedCostUsd 
    Int uniqueUsers 
    Int latencyP50Ms "❓"
    Int latencyP95Ms "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "asaas_webhook_events" {
    String id "🗝️"
    String eventType "❓"
    Json payload 
    AsaasWebhookEventStatus status 
    AsaasAccount account 
    String errorMessage "❓"
    Int attemptCount 
    DateTime nextAttemptAt 
    String failureReason "❓"
    DateTime receivedAt 
    DateTime processedAt "❓"
    DateTime updatedAt 
    }
  

  "backoffice_bot_host_settings" {
    String id "🗝️"
    String agentBaseUrl "❓"
    String agentTokenHash "❓"
    String n8nEnvEncrypted "❓"
    String evolutionEnvEncrypted "❓"
    String desiredHostVersion "❓"
    String appliedHostVersion "❓"
    DateTime lastAppliedAt "❓"
    BackofficeBotHostApplyStatus lastApplyStatus 
    String lastApplyError "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_bot_host_ops_jobs" {
    String id "🗝️"
    BackofficeBotHostOpsJobType type 
    BackofficeBotHostOpsJobStatus status 
    Json payload "❓"
    Json result "❓"
    String errorMessage "❓"
    DateTime startedAt "❓"
    DateTime finishedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_settings" {
    String id "🗝️"
    Boolean approvalRequired 
    UserRole approverRoles 
    String defaultBackgroundColor 
    String defaultTextColor 
    String defaultLineColor 
    String defaultAccentColor 
    String defaultButtonTextColor 
    String defaultInputBackgroundColor 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_rate_limits" {
    String key "🗝️"
    Int count 
    DateTime resetAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_forms" {
    String id "🗝️"
    String name 
    String description "❓"
    String publicId 
    PublicFormStatus status 
    PublicFormApprovalStatus approvalStatus 
    String coverTitle "❓"
    String coverDescription "❓"
    String coverBadge "❓"
    Json coverHighlights "❓"
    String ctaLabel 
    String successTitle 
    String successDescription "❓"
    Json successActions "❓"
    Json thankYouPages "❓"
    String defaultThankYouPageId "❓"
    Boolean useDefaultTheme 
    String backgroundColor "❓"
    String textColor "❓"
    String lineColor "❓"
    String accentColor "❓"
    String buttonTextColor "❓"
    String inputBackgroundColor "❓"
    Boolean schedulingEnabled 
    Int meetingDurationMinutes 
    String schedulingMessage "❓"
    String formKind 
    Boolean emailCampaignTrackingEnabled 
    Boolean leadCaptureDisabled 
    String reviewComment "❓"
    DateTime reviewedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_eligible_closers" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "corretor_studio_public_form_questions" {
    String id "🗝️"
    PublicFormQuestionType type 
    String title 
    String description "❓"
    String placeholder "❓"
    Boolean required 
    Int scoreWeight 
    Int position 
    Json config 
    PublicFormMappingTarget mappingTarget "❓"
    String mappingKey "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "corretor_studio_public_form_options" {
    String id "🗝️"
    String label 
    String value 
    Int position 
    Int score 
    String scorePolarity 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_rules" {
    String id "🗝️"
    String targetThankYouPageId "❓"
    PublicFormRuleOperator operator 
    Json comparisonValue "❓"
    PublicFormRuleAction action 
    PublicFormRuleAction elseAction 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_score_bands" {
    String id "🗝️"
    String label 
    String summary "❓"
    Int minScore 
    Int maxScore 
    Int position 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_publications" {
    String id "🗝️"
    Int version 
    Json snapshot 
    DateTime publishedAt 
    DateTime endedAt "❓"
    }
  

  "corretor_studio_public_form_submissions" {
    String id "🗝️"
    String requestKey 
    String eventId "❓"
    String visitorSessionId "❓"
    PublicFormCompletionStatus completionStatus 
    PublicFormSubmissionStatus status 
    Int score 
    String scoreBandLabel "❓"
    Json origin "❓"
    String errorMessage "❓"
    DateTime submittedAt "❓"
    DateTime submitRequestedAt "❓"
    DateTime dispatchAcceptedAt "❓"
    Int dispatchAttemptCount 
    DateTime nextDispatchAt "❓"
    String lastDispatchError "❓"
    String thankYouPageId "❓"
    DateTime scheduledMeetingStartsAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_answers" {
    String id "🗝️"
    Json value 
    Json questionSnapshot 
    String sourceEventId "❓"
    DateTime answeredAt "❓"
    String mappingKey "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_public_form_metric_events" {
    String id "🗝️"
    Json questionSnapshot "❓"
    String visitorSessionId 
    PublicFormMetricType eventType 
    String eventKey 
    String eventId "❓"
    Int schemaVersion "❓"
    DateTime occurredAt "❓"
    Json origin "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_public_form_journey_sessions" {
    String id "🗝️"
    String visitorSessionId 
    PublicFormJourneyState state 
    DateTime startedAt 
    DateTime lastActivityAt 
    String currentPageId "❓"
    Int currentPageIndex "❓"
    DateTime lastExitIntentAt "❓"
    DateTime lastAbandonedAt "❓"
    DateTime lastResumedAt "❓"
    Int abandonmentCount 
    DateTime submittedAt "❓"
    DateTime completedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_lead_extractions" {
    String id "🗝️"
    Json filters 
    Int totalCount 
    BackofficeLeadExtractionStatus status 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_lead_extraction_results" {
    String id "🗝️"
    String taxId 
    String name 
    String tradeName "❓"
    String email "❓"
    String phone "❓"
    String city "❓"
    String state "❓"
    String cnae "❓"
    String cnaeName "❓"
    BackofficeCompanyType type "❓"
    Json raw "❓"
    DateTime createdAt 
    }
  

  "short_links" {
    String id "🗝️"
    String code 
    String targetUrl 
    DateTime expiresAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_cnaes" {
    Int id "🗝️"
    String code 
    String name 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_public_form_templates" {
    String id "🗝️"
    String slug 
    String name 
    String description "❓"
    String formKind 
    Json draft 
    Int sortOrder 
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_tags" {
    String id "🗝️"
    String name 
    String color 
    Int sortOrder 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_tag_assignments" {
    String id "🗝️"
    DateTime createdAt 
    }
  

  "corretor_studio_lead_document_requests" {
    String id "🗝️"
    String teamId 
    String publicToken 
    String message "❓"
    LeadDocumentRequestStatus status 
    DateTime lastEmailSentAt "❓"
    DateTime expiresAt 
    DateTime completedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_document_request_items" {
    String id "🗝️"
    String name 
    String description "❓"
    Boolean isRequired 
    DateTime uploadedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  
    "corretor_studio_profiles" |o--|| "UserRole" : "enum:role"
    "corretor_studio_profiles" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_profiles" |o--|| "AsaasAccount" : "enum:asaasCustomerAccount"
    "corretor_studio_profiles" |o--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "corretor_studio_profiles" |o--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "corretor_studio_profiles" |o--|| "AsaasAccount" : "enum:asaasSubscriptionAccount"
    "corretor_studio_profiles" |o--|o corretor_studio_profiles : "manager"
    "corretor_studio_profiles" |o--|o corretor_studio_profiles : "sponsorMaster"
    "corretor_studio_profiles" }o--|o google_oauth_connections : "googleConnection"
    "corretor_studio_profiles" |o--|o corretor_studio_profiles : "deletedByProfile"
    "corretor_studio_health_plan_options" }o--|o corretor_studio_profiles : "creator"
    "backoffice_users" |o--|| corretor_studio_profiles : "profile"
    "backoffice_users" }o--|o corretor_studio_profiles : "creator"
    "backoffice_users" }o--|o google_oauth_connections : "googleConnection"
    "backoffice_users" }o--|o corretor_studio_profiles : "linkedCorretorStudioProfile"
    "backoffice_deletion_requests" |o--|| "BackofficeDeletionRequestType" : "enum:type"
    "backoffice_deletion_requests" |o--|| "BackofficeDeletionRequestStatus" : "enum:status"
    "backoffice_deletion_requests" }o--|| corretor_studio_profiles : "requestedBy"
    "backoffice_deletion_approvals" |o--|| "BackofficeDeletionApprovalDecision" : "enum:decision"
    "backoffice_deletion_approvals" }o--|| backoffice_deletion_requests : "request"
    "backoffice_deletion_approvals" }o--|| corretor_studio_profiles : "approver"
    "backoffice_deletion_audit_logs" |o--|| "BackofficeDeletionEntityType" : "enum:entityType"
    "backoffice_deletion_audit_logs" }o--|o corretor_studio_profiles : "actor"
    "backoffice_deletion_audit_logs" }o--|o backoffice_deletion_requests : "request"
    "backoffice_database_backups" |o--|| "BackofficeDatabaseBackupStatus" : "enum:status"
    "backoffice_database_backups" |o--|| "BackofficeDatabaseBackupSource" : "enum:source"
    "backoffice_banned_users" |o--|| "BackofficeBanStatus" : "enum:status"
    "backoffice_banned_users" |o--|| "BackofficeBanScope" : "enum:scope"
    "backoffice_banned_users" }o--|| corretor_studio_profiles : "profile"
    "backoffice_banned_users" }o--|| corretor_studio_profiles : "bannedByProfile"
    "backoffice_banned_users" }o--|o corretor_studio_profiles : "liftedByProfile"
    "backoffice_authorized_sponsors" |o--|| corretor_studio_profiles : "profile"
    "backoffice_authorized_sponsors" }o--|o corretor_studio_profiles : "grantedBy"
    "backoffice_authorized_sponsors" }o--|o corretor_studio_profiles : "revokedBy"
    "backoffice_operational_access_grants" |o--|| "BackofficeOperationalCapability" : "enum:capability"
    "backoffice_operational_access_grants" }o--|o corretor_studio_profiles : "profile"
    "backoffice_operational_access_grants" }o--|o corretor_studio_teams : "team"
    "backoffice_operational_access_grants" }o--|o corretor_studio_profiles : "grantedBy"
    "backoffice_operational_access_grants" }o--|o corretor_studio_profiles : "revokedBy"
    "backoffice_team_email_limit_grants" |o--|| corretor_studio_teams : "team"
    "backoffice_team_email_limit_grants" }o--|| corretor_studio_profiles : "grantedBy"
    "backoffice_team_email_limit_grants" }o--|o corretor_studio_profiles : "revokedBy"
    "google_oauth_connections" }o--|o corretor_studio_profiles : "ownerProfile"
    "backoffice_clients" }o--|o corretor_studio_profiles : "creator"
    "backoffice_payments" |o--|| "AsaasAccount" : "enum:asaasAccount"
    "backoffice_payments" }o--|| backoffice_clients : "client"
    "backoffice_payments" }o--|o corretor_studio_profiles : "creator"
    "backoffice_contracts" }o--|o backoffice_clients : "client"
    "backoffice_contracts" }o--|| corretor_studio_profiles : "creator"
    "backoffice_contract_versions" }o--|| backoffice_contracts : "contract"
    "backoffice_contract_versions" }o--|| corretor_studio_profiles : "importedBy"
    "backoffice_contract_versions" }o--|o corretor_studio_profiles : "shareGeneratedBy"
    "backoffice_leads" |o--|| "BackofficeLeadStatus" : "enum:status"
    "backoffice_leads" |o--|| "BackofficeLeadOrigin" : "enum:origin"
    "backoffice_leads" }o--|o corretor_studio_profiles : "creator"
    "backoffice_leads" |o--|o backoffice_webhook_events : "sourceWebhookEvent"
    "backoffice_leads" }o--|o backoffice_users : "sdrBackofficeUser"
    "backoffice_leads" }o--|o backoffice_users : "closerBackofficeUser"
    "backoffice_lead_offers" }o--|| backoffice_leads : "lead"
    "backoffice_lead_offers" }o--|o corretor_studio_profiles : "shareGeneratedBy"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionPlan" : "enum:plan"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionBillingCycle" : "enum:cycle"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionStatus" : "enum:status"
    "backoffice_adhesions" |o--|| "AsaasAccount" : "enum:asaasAccount"
    "backoffice_adhesions" |o--|| backoffice_leads : "lead"
    "backoffice_adhesions" }o--|o backoffice_products : "product"
    "backoffice_adhesions" }o--|o backoffice_users : "sdrBackofficeUser"
    "backoffice_adhesions" }o--|o backoffice_users : "closerBackofficeUser"
    "backoffice_adhesions" }o--|o backoffice_users : "createdByBackofficeUser"
    "backoffice_adhesions" }o--|o corretor_studio_profiles : "sponsorMaster"
    "backoffice_adhesions" }o--|o corretor_studio_profiles : "discountApprovedBy"
    "backoffice_leads_schedule" |o--|o "BackofficeInviteDispatchStatus" : "enum:inviteDispatchStatus"
    "backoffice_leads_schedule" }o--|| backoffice_leads : "lead"
    "backoffice_leads_schedule" }o--|o backoffice_users : "closer"
    "backoffice_email_dispatches" |o--|| "BackofficeEmailRecipientKind" : "enum:recipientKind"
    "backoffice_email_dispatches" |o--|| "BackofficeEmailDispatchProvider" : "enum:provider"
    "backoffice_email_dispatches" |o--|| "BackofficeEmailDispatchCategory" : "enum:category"
    "backoffice_email_dispatches" |o--|| "BackofficeEmailDispatchStatus" : "enum:status"
    "backoffice_email_dispatches" }o--|| corretor_studio_profiles : "profile"
    "backoffice_email_dispatch_events" |o--|| "BackofficeEmailDispatchEventType" : "enum:type"
    "backoffice_email_dispatch_events" }o--|| backoffice_email_dispatches : "dispatch"
    "backoffice_webhook_events" |o--|| "BackofficeWebhookSource" : "enum:source"
    "backoffice_webhook_events" |o--|| "BackofficeWebhookEventStatus" : "enum:status"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookSource" : "enum:source"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookTokenStatus" : "enum:status"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookTokenExpiryMode" : "enum:expiryMode"
    "backoffice_webhook_tokens" }o--|| backoffice_users : "generatedBy"
    "backoffice_webhook_request_logs" |o--|| "BackofficeWebhookSource" : "enum:source"
    "backoffice_cron_executions" |o--|| "BackofficeCronStatus" : "enum:status"
    "backoffice_email_contact_lists" }o--|o backoffice_users : "createdBy"
    "backoffice_email_contacts" }o--|| backoffice_email_contact_lists : "list"
    "backoffice_email_contacts" }o--|o backoffice_leads : "lead"
    "backoffice_email_import_jobs" |o--|| "BackofficeEmailImportSourceFormat" : "enum:sourceFormat"
    "backoffice_email_import_jobs" |o--|| "BackofficeEmailImportJobStatus" : "enum:status"
    "backoffice_email_import_jobs" }o--|| backoffice_email_contact_lists : "list"
    "backoffice_email_import_jobs" }o--|| backoffice_users : "createdBy"
    "backoffice_email_campaigns" |o--|| "BackofficeEmailCampaignType" : "enum:type"
    "backoffice_email_campaigns" |o--|| "BackofficeEmailCampaignStatus" : "enum:status"
    "backoffice_email_campaigns" }o--|| backoffice_email_contact_lists : "contactList"
    "backoffice_email_campaigns" }o--|o backoffice_users : "createdBy"
    "backoffice_email_campaign_dispatches" |o--|| "BackofficeEmailCampaignDispatchStatus" : "enum:status"
    "backoffice_email_campaign_dispatches" }o--|| backoffice_email_campaigns : "campaign"
    "backoffice_email_logs" |o--|| "BackofficeEmailLogStatus" : "enum:status"
    "backoffice_email_logs" }o--|| backoffice_email_campaigns : "campaign"
    "backoffice_email_logs" }o--|| backoffice_email_campaign_dispatches : "dispatch"
    "backoffice_email_logs" }o--|| backoffice_email_contacts : "contact"
    "backoffice_email_events" |o--|| "BackofficeEmailEventType" : "enum:type"
    "backoffice_email_events" }o--|| backoffice_email_logs : "log"
    "backoffice_email_orphan_events" |o--|| "BackofficeEmailOrphanEventStatus" : "enum:status"
    "corretor_studio_leads" |o--|o "LeadStatus" : "enum:status"
    "corretor_studio_leads" |o--|o "MeetingHeald" : "enum:meetingHeald"
    "corretor_studio_leads" |o--|o "LeadStatus" : "enum:followUpSourceStatus"
    "corretor_studio_leads" |o--|o "LeadOriginChannel" : "enum:originChannel"
    "corretor_studio_leads" }o--|| corretor_studio_profiles : "manager"
    "corretor_studio_leads" }o--|o corretor_studio_teams : "team"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "assignee"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "closer"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "creator"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "updater"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "deletedBy"
    "corretor_studio_leads" |o--|o corretor_studio_leads : "referrerLead"
    "corretor_studio_lead_activities" |o--|| "ActivityType" : "enum:type"
    "corretor_studio_lead_activities" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_activities" }o--|o corretor_studio_profiles : "author"
    "corretor_studio_lead_activity_reactions" }o--|| corretor_studio_lead_activities : "activity"
    "corretor_studio_lead_activity_reactions" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_audit_logs" |o--|| "AuditEntityType" : "enum:entityType"
    "corretor_studio_audit_logs" |o--|| "AuditAction" : "enum:action"
    "corretor_studio_audit_logs" }o--|o corretor_studio_profiles : "actor"
    "corretor_studio_tasks" |o--|| "TaskType" : "enum:taskType"
    "corretor_studio_tasks" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_tasks" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_tasks" |o--|o corretor_studio_lead_activities : "activity"
    "corretor_studio_task_assignees" |o--|| "TaskAssigneeStatus" : "enum:status"
    "corretor_studio_task_assignees" }o--|| corretor_studio_tasks : "task"
    "corretor_studio_task_assignees" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_leads_schedule" |o--|o "InviteDispatchStatus" : "enum:inviteDispatchStatus"
    "corretor_studio_leads_schedule" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_finalized" |o--|| "ContractType" : "enum:contractType"
    "corretor_studio_lead_finalized" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_finalized" }o--|o corretor_studio_profiles : "closer"
    "corretor_studio_lead_finalized_holders" |o--|| corretor_studio_lead_finalized : "leadFinalized"
    "corretor_studio_lead_finalized_dependents" }o--|| corretor_studio_lead_finalized : "leadFinalized"
    "corretor_studio_lead_portfolio" |o--|| "PortfolioStatus" : "enum:portfolioStatus"
    "corretor_studio_lead_portfolio" |o--|| "RenewalStatus" : "enum:renewalStatus"
    "corretor_studio_lead_portfolio" |o--|| "PortfolioSource" : "enum:source"
    "corretor_studio_lead_portfolio" |o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_portfolio" }o--|| corretor_studio_teams : "team"
    "corretor_studio_lead_attachments" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_attachments" }o--|| corretor_studio_profiles : "uploader"
    "corretor_studio_lead_proposal_reviews" |o--|| "LeadProposalReviewStatus" : "enum:status"
    "corretor_studio_lead_proposal_reviews" |o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_proposal_reviews" }o--|o corretor_studio_profiles : "reviewedBy"
    "corretor_studio_lead_required_documents" |o--|| "LeadRequiredDocumentType" : "enum:documentType"
    "corretor_studio_lead_required_documents" |o--|| "LeadRequiredDocumentStatus" : "enum:status"
    "corretor_studio_lead_required_documents" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_required_documents" }o--|o corretor_studio_lead_attachments : "attachment"
    "corretor_studio_lead_required_documents" }o--|o corretor_studio_profiles : "reviewedBy"
    "corretor_studio_pending_operators" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_pending_operators" }o--|| corretor_studio_profiles : "manager"
    "corretor_studio_pending_operators" }o--|o corretor_studio_teams : "team"
    "corretor_studio_teams" }o--|| corretor_studio_profiles : "master"
    "corretor_studio_teams" }o--|o corretor_studio_profiles : "deletedBy"
    "corretor_studio_team_filter_presets" |o--|| "FilterPresetScope" : "enum:scope"
    "corretor_studio_team_filter_presets" |o--|| "FilterPresetVisibility" : "enum:visibility"
    "corretor_studio_team_filter_presets" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_filter_presets" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_team_status_rules" |o--|| "TeamStatusRuleType" : "enum:type"
    "corretor_studio_team_status_rules" |o--|| "LeadStatus" : "enum:targetStatus"
    "corretor_studio_team_status_rules" |o--|o "LeadStatus" : "enum:requiredStatus"
    "corretor_studio_team_status_rules" |o--|o "TeamLeadTimeUnit" : "enum:leadTimeUnit"
    "corretor_studio_team_status_rules" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_status_rules" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_lead_custom_field_definitions" |o--|| "LeadCustomFieldType" : "enum:type"
    "corretor_studio_lead_custom_field_definitions" }o--|| corretor_studio_teams : "team"
    "corretor_studio_lead_custom_field_definitions" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_lead_custom_field_values" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_custom_field_values" }o--|| corretor_studio_lead_custom_field_definitions : "definition"
    "corretor_studio_team_automation_rules" |o--|| "TeamAutomationTriggerType" : "enum:triggerType"
    "corretor_studio_team_automation_rules" |o--|| "TeamAutomationActionType" : "enum:actionType"
    "corretor_studio_team_automation_rules" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_automation_rules" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_team_automation_run_logs" |o--|| "TeamAutomationRunStatus" : "enum:status"
    "corretor_studio_team_automation_run_logs" }o--|| corretor_studio_team_automation_rules : "rule"
    "corretor_studio_team_automation_run_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_studio_webhook_configs" |o--|| "StudioWebhookTokenExpiryMode" : "enum:expiryMode"
    "corretor_studio_team_studio_webhook_configs" |o--|| corretor_studio_teams : "team"
    "corretor_studio_team_studio_webhook_configs" }o--|| corretor_studio_profiles : "updatedBy"
    "corretor_studio_team_studio_webhook_request_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_radar_pixel_configs" |o--|| corretor_studio_teams : "team"
    "corretor_studio_team_radar_pixel_configs" }o--|| corretor_studio_profiles : "updatedBy"
    "corretor_studio_team_radar_pixel_hit_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_webhooks" |o--|| "TeamWebhookDirection" : "enum:direction"
    "corretor_studio_team_webhooks" |o--|| "TeamWebhookStatus" : "enum:status"
    "corretor_studio_team_webhooks" |o--|o "TeamWebhookDestinationPreset" : "enum:destinationPreset"
    "corretor_studio_team_webhooks" |o--}o "TeamWebhookEventKey" : "enum:selectedEvents"
    "corretor_studio_team_webhooks" |o--|o "StudioWebhookTokenExpiryMode" : "enum:expiryMode"
    "corretor_studio_team_webhooks" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_webhooks" }o--|| corretor_studio_profiles : "updatedBy"
    "corretor_studio_team_webhook_event_logs" |o--|| "TeamWebhookDirection" : "enum:direction"
    "corretor_studio_team_webhook_event_logs" |o--|| "TeamWebhookLogResult" : "enum:result"
    "corretor_studio_team_webhook_event_logs" |o--|o "TeamWebhookEventKey" : "enum:eventKey"
    "corretor_studio_team_webhook_event_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_webhook_event_logs" }o--|| corretor_studio_team_webhooks : "webhook"
    "corretor_studio_team_webhook_outbox" |o--|| "TeamWebhookEventKey" : "enum:eventKey"
    "corretor_studio_team_webhook_outbox" |o--|| "TeamWebhookOutboxStatus" : "enum:status"
    "corretor_studio_team_webhook_outbox" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_webhook_outbox" }o--|| corretor_studio_team_webhooks : "webhook"
    "corretor_studio_notifications" |o--|| "NotificationType" : "enum:type"
    "corretor_studio_notifications" }o--|| corretor_studio_profiles : "recipient"
    "corretor_studio_notifications" }o--|o corretor_studio_profiles : "actor"
    "corretor_studio_notifications" }o--|| corretor_studio_teams : "team"
    "meeting_follow_up_digest_logs" }o--|| corretor_studio_profiles : "recipient"
    "meeting_follow_up_digest_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_profile_web_push_subscriptions" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_profile_web_push_consents" |o--|| "WebPushConsentStatus" : "enum:status"
    "corretor_studio_profile_web_push_consents" |o--|| corretor_studio_profiles : "profile"
    "corretor_studio_platform_purchases" |o--|| "PlatformPurchaseType" : "enum:purchase_type"
    "corretor_studio_platform_purchases" |o--|| "PlatformPurchaseStatus" : "enum:status"
    "corretor_studio_platform_purchases" |o--|| "AsaasAccount" : "enum:asaas_account"
    "corretor_studio_platform_purchases" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_platform_purchases" }o--|o corretor_studio_teams : "team"
    "corretor_studio_asaas_notification_backfill" |o--|| "AsaasNotificationBackfillStatus" : "enum:status"
    "corretor_studio_pending_actions" |o--|| "PendingActionType" : "enum:actionType"
    "corretor_studio_pending_actions" |o--|| "PendingActionStatus" : "enum:status"
    "corretor_studio_pending_actions" }o--|| corretor_studio_profiles : "master"
    "corretor_studio_pending_actions" }o--|o corretor_studio_teams : "team"
    "corretor_studio_team_members" |o--|| "UserRole" : "enum:role"
    "corretor_studio_team_members" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_team_members" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_members" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_team_transfer_routes" }o--|| corretor_studio_teams : "sourceTeam"
    "corretor_studio_team_transfer_routes" }o--|| corretor_studio_teams : "targetTeam"
    "corretor_studio_team_transfer_routes" }o--|o corretor_studio_profiles : "creator"
    "corretor_studio_lead_transfers" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_transfers" }o--|| corretor_studio_teams : "fromTeam"
    "corretor_studio_lead_transfers" }o--|| corretor_studio_teams : "toTeam"
    "corretor_studio_lead_transfers" }o--|| corretor_studio_profiles : "transferredByProfile"
    "corretor_studio_lead_transfers" }o--|o corretor_studio_profiles : "receivedByProfile"
    "corretor_studio_email_credit_subscriptions" |o--|| "EmailCreditPlan" : "enum:plan"
    "corretor_studio_email_credit_subscriptions" |o--|| "EmailCreditSubscriptionStatus" : "enum:status"
    "corretor_studio_email_credit_subscriptions" |o--|| corretor_studio_teams : "team"
    "corretor_studio_email_credit_payment_grants" |o--|| "EmailCreditPlan" : "enum:plan"
    "corretor_studio_email_credit_payment_grants" |o--|| "AsaasAccount" : "enum:asaasAccount"
    "corretor_studio_email_credit_usages" }o--|| corretor_studio_email_credit_subscriptions : "subscription"
    "corretor_studio_team_email_campaign_limit_grants" |o--|| corretor_studio_teams : "team"
    "corretor_studio_email_templates" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_templates" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_templates" }o--|o backoffice_users : "managedByBackofficeUser"
    "corretor_studio_email_templates" }o--|o corretor_studio_profiles : "approver"
    "corretor_studio_email_templates" }o--|o corretor_studio_profiles : "rejecter"
    "corretor_studio_email_templates" ||--|| corretor_studio_email_templates : "versionGroup"
    "corretor_studio_email_template_history" }o--|| corretor_studio_email_templates : "template"
    "corretor_studio_email_template_history" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_template_history" }o--|o corretor_studio_profiles : "actor"
    "corretor_studio_email_contact_lists" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_contact_lists" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_contact_lists" }o--|o backoffice_users : "managedByBackofficeUser"
    "corretor_studio_email_contact_lists" }o--|o corretor_studio_radar_segments : "radarSegment"
    "corretor_studio_email_import_jobs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_import_jobs" }o--|| corretor_studio_email_contact_lists : "list"
    "corretor_studio_email_import_jobs" }o--|| corretor_studio_profiles : "requester"
    "corretor_studio_email_import_jobs" }o--|o backoffice_users : "managedByBackofficeUser"
    "corretor_studio_email_contacts" }o--|| corretor_studio_email_contact_lists : "list"
    "corretor_studio_email_contact_radar_sync_outbox" |o--|| "EmailContactRadarSyncOutboxStatus" : "enum:status"
    "corretor_studio_email_contact_radar_sync_outbox" |o--|| corretor_studio_email_contacts : "emailContact"
    "corretor_studio_email_contact_radar_sync_outbox" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_contact_radar_sync_outbox" }o--|o corretor_studio_email_import_jobs : "emailImportJob"
    "corretor_studio_email_campaigns" |o--|| "EmailCampaignStatus" : "enum:status"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_campaigns" }o--|o backoffice_users : "managedByBackofficeUser"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_email_templates : "template"
    "corretor_studio_email_campaigns" }o--|o corretor_studio_email_contact_lists : "contactList"
    "corretor_studio_email_campaigns" |o--|o corretor_studio_email_campaigns : "parentCampaign"
    "corretor_studio_email_campaign_dispatches" |o--|| "EmailCampaignDispatchStatus" : "enum:status"
    "corretor_studio_email_campaign_dispatches" |o--|| "EmailCampaignBatchIdempotencyScheme" : "enum:batchIdempotencyScheme"
    "corretor_studio_email_campaign_dispatches" }o--|| corretor_studio_email_campaigns : "campaign"
    "corretor_studio_email_campaign_dispatches" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_campaign_dispatches" }o--|| corretor_studio_email_templates : "template"
    "corretor_studio_email_campaign_dispatches" }o--|o corretor_studio_email_contact_lists : "contactList"
    "corretor_studio_email_campaign_dispatches" }o--|| corretor_studio_profiles : "triggerer"
    "corretor_studio_email_logs" |o--|| "EmailLogCategory" : "enum:category"
    "corretor_studio_email_logs" |o--|| "EmailLogStatus" : "enum:status"
    "corretor_studio_email_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_logs" }o--|o corretor_studio_email_campaigns : "campaign"
    "corretor_studio_email_logs" }o--|o corretor_studio_email_campaign_dispatches : "dispatch"
    "corretor_studio_email_events" |o--|| "EmailEventType" : "enum:type"
    "corretor_studio_email_events" }o--|| corretor_studio_email_logs : "log"
    "email_orphan_events" |o--|| "EmailOrphanEventStatus" : "enum:status"
    "corretor_studio_resend_webhook_processing_failures" |o--|| "ResendWebhookProcessingFailureStatus" : "enum:status"
    "corretor_studio_public_form_queue_event_failures" |o--|| "PublicFormQueueEventKind" : "enum:kind"
    "corretor_studio_public_form_queue_event_failures" |o--|| "PublicFormQueueEventFailureStatus" : "enum:status"
    "corretor_studio_queue_processing_failures" |o--|| "QueueProcessingFailureStatus" : "enum:status"
    "backoffice_products" |o--|| "BackofficeProductType" : "enum:type"
    "backoffice_products" |o--|| "BackofficeProductBillingMode" : "enum:billingMode"
    "backoffice_features" |o--|| "BackofficeFeatureAccessMode" : "enum:accessMode"
    "backoffice_features" |o--|| "BackofficeFeatureAccessLevel" : "enum:defaultAccessLevel"
    "backoffice_features" |o--|o backoffice_features : "parent"
    "backoffice_feature_access_rules" |o--|| "BackofficeAccessPrincipal" : "enum:principal"
    "backoffice_feature_access_rules" |o--|| "BackofficeFeatureAccessLevel" : "enum:accessLevel"
    "backoffice_feature_access_rules" }o--|| backoffice_features : "feature"
    "backoffice_feature_grants" |o--|| "BackofficeFeatureGrantType" : "enum:grantType"
    "backoffice_feature_grants" |o--|| "BackofficeFeatureAccessLevel" : "enum:accessLevel"
    "backoffice_feature_grants" |o--|| "BackofficeBetaTeamScope" : "enum:betaTeamScope"
    "backoffice_feature_grants" }o--|| backoffice_features : "feature"
    "backoffice_feature_grants" }o--|| corretor_studio_profiles : "profile"
    "backoffice_feature_grant_teams" }o--|| backoffice_feature_grants : "grant"
    "backoffice_feature_grant_teams" }o--|| corretor_studio_teams : "team"
    "backoffice_product_payment_rules" |o--|| "BackofficePaymentMethod" : "enum:paymentMethod"
    "backoffice_product_payment_rules" |o--|| "BackofficeAdhesionBillingCycle" : "enum:billingCycle"
    "backoffice_product_payment_rules" |o--|| "InstallmentSplitMode" : "enum:installmentSplitMode"
    "backoffice_product_payment_rules" }o--|| backoffice_products : "product"
    "backoffice_lead_status_transition_field_rules" |o--|| "LeadStatus" : "enum:targetStatus"
    "backoffice_lead_status_transition_field_rules" |o--|| "BackofficeLeadTransitionFieldKey" : "enum:fieldKey"
    "backoffice_lead_status_transition_field_rules" }o--|| corretor_studio_profiles : "updatedBy"
    "backoffice_lead_status_transition_gates" |o--|| "BackofficeLeadTransitionGateType" : "enum:gateType"
    "backoffice_lead_status_transition_gates" |o--|o "LeadStatus" : "enum:sourceStatus"
    "backoffice_lead_status_transition_gates" |o--|o "LeadStatus" : "enum:targetStatus"
    "backoffice_lead_status_transition_gates" }o--|| corretor_studio_profiles : "updatedBy"
    "backoffice_crm_lead_status_transition_gates" |o--|| "BackofficeLeadTransitionGateType" : "enum:gateType"
    "backoffice_crm_lead_status_transition_gates" |o--|o "BackofficeLeadStatus" : "enum:sourceStatus"
    "backoffice_crm_lead_status_transition_gates" |o--|o "BackofficeLeadStatus" : "enum:targetStatus"
    "backoffice_crm_lead_status_transition_gates" }o--|| corretor_studio_profiles : "updatedBy"
    "backoffice_radar_outbox_throughput_configs" }o--|o corretor_studio_profiles : "updatedBy"
    "backoffice_crm_lead_status_transition_field_rules" |o--|| "BackofficeLeadStatus" : "enum:targetStatus"
    "backoffice_crm_lead_status_transition_field_rules" |o--|| "BackofficeLeadTransitionFieldKey" : "enum:fieldKey"
    "backoffice_crm_lead_status_transition_field_rules" }o--|| corretor_studio_profiles : "updatedBy"
    "backoffice_user_subscriptions" |o--|| "BackofficeSubscriptionStatus" : "enum:status"
    "backoffice_user_subscriptions" |o--|o "BackofficeAdhesionBillingCycle" : "enum:cycle"
    "backoffice_user_subscriptions" }o--|| corretor_studio_profiles : "profile"
    "backoffice_user_subscriptions" }o--|| backoffice_products : "product"
    "corretor_studio_profile_subscriptions" |o--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "corretor_studio_profile_subscriptions" |o--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "corretor_studio_profile_subscriptions" |o--|| corretor_studio_profiles : "profile"
    "corretor_studio_profile_subscriptions" |o--|o backoffice_adhesions : "adhesion"
    "corretor_studio_profile_subscriptions" }o--|o backoffice_products : "product"
    "corretor_studio_subscription_change_logs" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_subscription_change_logs" }o--|o corretor_studio_profiles : "actor"
    "corretor_studio_profile_subscription_capacities" |o--|| corretor_studio_profile_subscriptions : "profileSubscription"
    "email_team_settings" |o--|| corretor_studio_teams : "team"
    "corretor_studio_email_team_domain_events" }o--|| corretor_studio_teams : "team"
    "email_team_senders" }o--|| corretor_studio_teams : "team"
    "email_team_variables" |o--|| "EmailVariableValueSource" : "enum:valueSource"
    "email_team_variables" }o--|| corretor_studio_teams : "team"
    "profile_user_type_assignments" |o--|| corretor_studio_profiles : "profile"
    "profile_user_type_assignments" }o--|| profile_user_types : "userType"
    "profile_user_type_assignments" }o--|o corretor_studio_profiles : "assignedBy"
    "team_whatsapp_contacts" |o--|| "TeamWhatsAppContactSource" : "enum:source"
    "team_whatsapp_contacts" |o--|| "WhatsAppContactNameSource" : "enum:nameSource"
    "team_whatsapp_contacts" |o--|| "WhatsAppContactSyncState" : "enum:syncState"
    "team_whatsapp_contacts" }o--|| corretor_studio_teams : "team"
    "whatsapp_contact_identities" }o--|| corretor_studio_teams : "team"
    "whatsapp_contact_identities" }o--|o team_whatsapp_configs : "config"
    "whatsapp_contact_identities" }o--|| team_whatsapp_contacts : "contact"
    "team_whatsapp_configs" |o--|| "WhatsAppProvider" : "enum:provider"
    "team_whatsapp_configs" |o--|| "WhatsAppEngine" : "enum:engine"
    "team_whatsapp_configs" |o--|| "WhatsAppConnectionStatus" : "enum:status"
    "team_whatsapp_configs" |o--|| "WhatsAppHistorySyncStatus" : "enum:historySyncStatus"
    "team_whatsapp_configs" |o--|| corretor_studio_teams : "team"
    "team_whatsapp_configs" }o--|| corretor_studio_profiles : "createdBy"
    "team_whatsapp_configs" }o--|| corretor_studio_profiles : "updatedBy"
    "team_whatsapp_configs" |o--|o team_whatsapp_configs : "primaryConfig"
    "whatsapp_conversations" |o--|| "WhatsAppContactNameSource" : "enum:contactNameSource"
    "whatsapp_conversations" |o--|| "WhatsAppHandoffMode" : "enum:handoffMode"
    "whatsapp_conversations" }o--|| corretor_studio_teams : "team"
    "whatsapp_conversations" }o--|| team_whatsapp_configs : "config"
    "whatsapp_conversations" }o--|o team_whatsapp_contacts : "contact"
    "whatsapp_conversations" }o--|o corretor_studio_leads : "lead"
    "whatsapp_conversations" }o--|o corretor_studio_profiles : "assignedProfile"
    "whatsapp_conversations" }o--|o corretor_studio_profiles : "createdByProfile"
    "whatsapp_messages" |o--|| "WhatsAppMessageDirection" : "enum:direction"
    "whatsapp_messages" |o--|| "WhatsAppMessageType" : "enum:messageType"
    "whatsapp_messages" |o--|| "WhatsAppMessageStatus" : "enum:status"
    "whatsapp_messages" |o--|o "WhatsAppMediaStatus" : "enum:mediaStatus"
    "whatsapp_messages" }o--|| whatsapp_conversations : "conversation"
    "whatsapp_messages" }o--|| corretor_studio_teams : "team"
    "whatsapp_messages" }o--|| team_whatsapp_configs : "config"
    "whatsapp_messages" }o--|o corretor_studio_leads : "lead"
    "whatsapp_messages" }o--|o corretor_studio_profiles : "sentByProfile"
    "whatsapp_messages" }o--|o corretor_studio_profiles : "deletedByProfile"
    "whatsapp_messages" }o--|o whatsapp_auto_response_rules : "autoResponseRule"
    "whatsapp_messages" |o--|o whatsapp_messages : "quotedMessage"
    "whatsapp_message_reactions" }o--|| whatsapp_messages : "message"
    "whatsapp_message_reactions" }o--|| corretor_studio_teams : "team"
    "whatsapp_message_reactions" }o--|o corretor_studio_profiles : "profile"
    "whatsapp_message_favorites" }o--|| whatsapp_messages : "message"
    "whatsapp_message_favorites" }o--|| corretor_studio_teams : "team"
    "whatsapp_message_favorites" }o--|| corretor_studio_profiles : "profile"
    "whatsapp_message_pins" }o--|| whatsapp_messages : "message"
    "whatsapp_message_pins" }o--|| corretor_studio_teams : "team"
    "whatsapp_message_pins" }o--|| whatsapp_conversations : "conversation"
    "whatsapp_message_pins" }o--|| corretor_studio_profiles : "pinnedBy"
    "whatsapp_message_visibility" }o--|| whatsapp_messages : "message"
    "whatsapp_message_visibility" }o--|| corretor_studio_teams : "team"
    "whatsapp_message_visibility" }o--|| corretor_studio_profiles : "profile"
    "whatsapp_message_action_commands" |o--|| "WhatsAppMessageActionCommandKind" : "enum:kind"
    "whatsapp_message_action_commands" |o--|| "WhatsAppMessageActionCommandStatus" : "enum:status"
    "whatsapp_message_action_commands" }o--|| whatsapp_messages : "message"
    "whatsapp_message_action_commands" }o--|| corretor_studio_teams : "team"
    "whatsapp_message_action_commands" }o--|| corretor_studio_profiles : "profile"
    "whatsapp_outbound_commands" |o--|| "WhatsAppOutboundCommandStatus" : "enum:status"
    "whatsapp_outbound_commands" }o--|| corretor_studio_teams : "team"
    "whatsapp_outbound_commands" }o--|| whatsapp_conversations : "conversation"
    "whatsapp_sync_jobs" }o--|| corretor_studio_teams : "team"
    "whatsapp_sync_jobs" }o--|| team_whatsapp_configs : "config"
    "whatsapp_webhook_events" |o--|| "WhatsAppWebhookEventStatus" : "enum:status"
    "whatsapp_webhook_events" }o--|| team_whatsapp_configs : "config"
    "whatsapp_webhook_events" }o--|| corretor_studio_teams : "team"
    "whatsapp_audit_events" }o--|| corretor_studio_teams : "team"
    "whatsapp_audit_events" }o--|o whatsapp_conversations : "conversation"
    "whatsapp_audit_events" }o--|o corretor_studio_profiles : "actorProfile"
    "whatsapp_usage_events" |o--|| "WhatsAppProvider" : "enum:provider"
    "whatsapp_usage_events" |o--|| "WhatsAppUsageEventType" : "enum:eventType"
    "whatsapp_usage_events" |o--|o "WhatsAppMessageDirection" : "enum:direction"
    "whatsapp_usage_events" }o--|| corretor_studio_teams : "team"
    "whatsapp_usage_events" }o--|| team_whatsapp_configs : "config"
    "whatsapp_send_rate_limit_windows" }o--|| corretor_studio_teams : "team"
    "whatsapp_auto_response_rules" |o--|| "WhatsAppAutoResponseRuleType" : "enum:type"
    "whatsapp_auto_response_rules" |o--|| "WhatsAppAutoResponseMatchMode" : "enum:matchMode"
    "whatsapp_auto_response_rules" }o--|| team_whatsapp_configs : "config"
    "whatsapp_auto_response_logs" |o--|| "WhatsAppAutoResponseRuleType" : "enum:ruleType"
    "whatsapp_auto_response_logs" }o--|| whatsapp_conversations : "conversation"
    "whatsapp_auto_response_logs" }o--|o whatsapp_auto_response_rules : "rule"
    "whatsapp_conversation_tags" }o--|| corretor_studio_teams : "team"
    "whatsapp_conversation_tag_assignments" }o--|| whatsapp_conversations : "conversation"
    "whatsapp_conversation_tag_assignments" }o--|| whatsapp_conversation_tags : "tag"
    "corretor_studio_radar_profiles" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_identities" |o--|| "RadarIdentityType" : "enum:type"
    "corretor_studio_radar_identities" }o--|| corretor_studio_radar_profiles : "profile"
    "corretor_studio_radar_identities" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_source_links" |o--|| "RadarSourceType" : "enum:sourceType"
    "corretor_studio_radar_source_links" }o--|| corretor_studio_radar_profiles : "profile"
    "corretor_studio_radar_source_links" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_events" }o--|| corretor_studio_radar_profiles : "profile"
    "corretor_studio_radar_events" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_channel_consents" |o--|| "RadarChannel" : "enum:channel"
    "corretor_studio_radar_channel_consents" |o--|| "RadarConsentStatus" : "enum:status"
    "corretor_studio_radar_channel_consents" |o--|o "RadarConsentReason" : "enum:reason"
    "corretor_studio_radar_channel_consents" }o--|| corretor_studio_radar_profiles : "profile"
    "corretor_studio_radar_channel_consents" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_segments" |o--|| "SegmentSourceType" : "enum:sourceType"
    "corretor_studio_radar_segments" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_segments" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_radar_segments" |o--|o corretor_studio_radar_segments : "parent"
    "corretor_studio_radar_segments" }o--|o corretor_studio_email_campaigns : "sourceCampaign"
    "corretor_studio_team_radar_field_definitions" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_radar_field_definitions" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_team_radar_field_definitions" }o--|o corretor_studio_radar_import_jobs : "importJob"
    "corretor_studio_radar_import_jobs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_radar_import_jobs" }o--|| corretor_studio_profiles : "requester"
    "backoffice_bot_channels" |o--|| "BackofficeBotChannelType" : "enum:channelType"
    "backoffice_bot_channels" |o--|| "BackofficeBotChannelStatus" : "enum:status"
    "backoffice_bot_auth_challenges" |o--|| "BackofficeBotAuthChallengeSource" : "enum:source"
    "backoffice_bot_auth_challenges" |o--|| "BackofficeBotAuthChallengeStatus" : "enum:status"
    "backoffice_bot_auth_challenges" }o--|o corretor_studio_profiles : "profile"
    "backoffice_bot_user_links" |o--|| "BackofficeBotUserLinkSource" : "enum:linkedBy"
    "backoffice_bot_user_links" }o--|| corretor_studio_profiles : "profile"
    "backoffice_bot_user_links" |o--|o backoffice_bot_auth_challenges : "authChallenge"
    "backoffice_bot_sessions" }o--|| backoffice_bot_user_links : "userLink"
    "backoffice_bot_sessions" }o--|| corretor_studio_teams : "team"
    "backoffice_bot_messages" |o--|| "BackofficeBotMessageDirection" : "enum:direction"
    "backoffice_bot_messages" }o--|| backoffice_bot_channels : "channel"
    "backoffice_bot_messages" }o--|o backoffice_bot_user_links : "userLink"
    "backoffice_bot_notification_preferences" }o--|| corretor_studio_profiles : "profile"
    "backoffice_bot_event_outbox" |o--|| "BackofficeBotEventOutboxStatus" : "enum:status"
    "backoffice_bot_event_outbox" }o--|| corretor_studio_profiles : "profile"
    "backoffice_bot_outbound_delivery" |o--|| "BackofficeBotOutboundDeliveryStatus" : "enum:status"
    "backoffice_bot_ai_configurations" |o--|| "BackofficeBotAiProvider" : "enum:primaryProvider"
    "backoffice_bot_ai_configurations" }o--|o corretor_studio_profiles : "updatedByProfile"
    "backoffice_bot_ai_interactions" |o--|| "BackofficeBotAiCapability" : "enum:capability"
    "backoffice_bot_ai_interactions" |o--|| "BackofficeBotAiInteractionStatus" : "enum:status"
    "backoffice_bot_ai_interactions" }o--|o backoffice_bot_messages : "inboundMessage"
    "backoffice_bot_ai_interactions" }o--|o backoffice_bot_user_links : "userLink"
    "backoffice_bot_ai_interactions" }o--|o corretor_studio_profiles : "profile"
    "backoffice_bot_ai_attempts" |o--|| "BackofficeBotAiProvider" : "enum:provider"
    "backoffice_bot_ai_attempts" |o--|| "BackofficeBotAiCapability" : "enum:capability"
    "backoffice_bot_ai_attempts" |o--|| "BackofficeBotAiAttemptStatus" : "enum:status"
    "backoffice_bot_ai_attempts" }o--|| backoffice_bot_ai_interactions : "interaction"
    "backoffice_bot_ai_proposals" |o--|| "BackofficeBotAiActionProposalStatus" : "enum:status"
    "backoffice_bot_ai_proposals" }o--|| backoffice_bot_user_links : "userLink"
    "backoffice_bot_ai_proposals" }o--|o corretor_studio_profiles : "profile"
    "backoffice_bot_ai_proposals" }o--|o backoffice_bot_ai_interactions : "interaction"
    "backoffice_bot_ai_feedback" |o--|| "BackofficeBotAiFeedbackType" : "enum:type"
    "backoffice_bot_ai_feedback" }o--|| backoffice_bot_ai_interactions : "interaction"
    "backoffice_bot_ai_feedback" }o--|o backoffice_bot_user_links : "userLink"
    "backoffice_bot_ai_daily_usage" |o--|| "BackofficeBotAiProvider" : "enum:provider"
    "backoffice_bot_ai_daily_usage" |o--|| "BackofficeBotAiCapability" : "enum:capability"
    "asaas_webhook_events" |o--|| "AsaasWebhookEventStatus" : "enum:status"
    "asaas_webhook_events" |o--|| "AsaasAccount" : "enum:account"
    "backoffice_bot_host_settings" |o--|| "BackofficeBotHostApplyStatus" : "enum:lastApplyStatus"
    "backoffice_bot_host_ops_jobs" |o--|| "BackofficeBotHostOpsJobType" : "enum:type"
    "backoffice_bot_host_ops_jobs" |o--|| "BackofficeBotHostOpsJobStatus" : "enum:status"
    "backoffice_bot_host_ops_jobs" }o--|| corretor_studio_profiles : "requestedBy"
    "corretor_studio_public_form_settings" |o--}o "UserRole" : "enum:approverRoles"
    "corretor_studio_public_form_settings" |o--|| corretor_studio_teams : "team"
    "corretor_studio_public_forms" |o--|| "PublicFormStatus" : "enum:status"
    "corretor_studio_public_forms" |o--|| "PublicFormApprovalStatus" : "enum:approvalStatus"
    "corretor_studio_public_forms" }o--|| corretor_studio_teams : "team"
    "corretor_studio_public_forms" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_public_forms" }o--|o corretor_studio_profiles : "assignedSdr"
    "corretor_studio_public_forms" }o--|o corretor_studio_profiles : "reviewer"
    "corretor_studio_public_forms" }o--|o backoffice_users : "managedByBackofficeUser"
    "corretor_studio_public_form_eligible_closers" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_eligible_closers" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_public_form_questions" |o--|| "PublicFormQuestionType" : "enum:type"
    "corretor_studio_public_form_questions" |o--|o "PublicFormMappingTarget" : "enum:mappingTarget"
    "corretor_studio_public_form_questions" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_options" }o--|| corretor_studio_public_form_questions : "question"
    "corretor_studio_public_form_rules" |o--|| "PublicFormRuleOperator" : "enum:operator"
    "corretor_studio_public_form_rules" |o--|| "PublicFormRuleAction" : "enum:action"
    "corretor_studio_public_form_rules" |o--|| "PublicFormRuleAction" : "enum:elseAction"
    "corretor_studio_public_form_rules" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_rules" }o--|| corretor_studio_public_form_questions : "sourceQuestion"
    "corretor_studio_public_form_rules" }o--|o corretor_studio_public_form_questions : "targetQuestion"
    "corretor_studio_public_form_score_bands" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_publications" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_publications" }o--|| corretor_studio_profiles : "publishedBy"
    "corretor_studio_public_form_submissions" |o--|| "PublicFormCompletionStatus" : "enum:completionStatus"
    "corretor_studio_public_form_submissions" |o--|| "PublicFormSubmissionStatus" : "enum:status"
    "corretor_studio_public_form_submissions" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_submissions" }o--|| corretor_studio_public_form_publications : "publication"
    "corretor_studio_public_form_submissions" }o--|o corretor_studio_leads : "lead"
    "corretor_studio_public_form_answers" }o--|| corretor_studio_public_form_submissions : "submission"
    "corretor_studio_public_form_answers" }o--|o corretor_studio_public_form_questions : "question"
    "corretor_studio_public_form_metric_events" |o--|| "PublicFormMetricType" : "enum:eventType"
    "corretor_studio_public_form_metric_events" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_metric_events" }o--|| corretor_studio_public_form_publications : "publication"
    "corretor_studio_public_form_metric_events" }o--|o corretor_studio_public_form_questions : "question"
    "corretor_studio_public_form_journey_sessions" |o--|| "PublicFormJourneyState" : "enum:state"
    "corretor_studio_public_form_journey_sessions" }o--|| corretor_studio_public_forms : "form"
    "corretor_studio_public_form_journey_sessions" }o--|| corretor_studio_public_form_publications : "publication"
    "backoffice_lead_extractions" |o--|| "BackofficeLeadExtractionStatus" : "enum:status"
    "backoffice_lead_extractions" }o--|| corretor_studio_profiles : "profile"
    "backoffice_lead_extraction_results" |o--|o "BackofficeCompanyType" : "enum:type"
    "backoffice_lead_extraction_results" }o--|| backoffice_lead_extractions : "extraction"
    "corretor_studio_public_form_templates" }o--|o corretor_studio_teams : "team"
    "corretor_studio_lead_tags" }o--|| corretor_studio_teams : "team"
    "corretor_studio_lead_tag_assignments" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_tag_assignments" }o--|| corretor_studio_lead_tags : "tag"
    "corretor_studio_lead_document_requests" |o--|| "LeadDocumentRequestStatus" : "enum:status"
    "corretor_studio_lead_document_requests" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_document_requests" }o--|| corretor_studio_profiles : "createdBy"
    "corretor_studio_lead_document_request_items" }o--|| corretor_studio_lead_document_requests : "request"
    "corretor_studio_lead_document_request_items" }o--|o corretor_studio_lead_attachments : "attachment"
```
