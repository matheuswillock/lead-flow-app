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
    


        backoffice_lead_status {
            new_opportunity new_opportunity
scheduled scheduled
no_show no_show
new_adhesion new_adhesion
lost lost
implementation implementation
finalized finalized
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
semiannual semiannual
        }
    


        backoffice_lead_origin {
            manual manual
webhook_meta webhook_meta
        }
    


        backoffice_webhook_source {
            meta meta
        }
    


        backoffice_webhook_event_status {
            received received
processed processed
failed failed
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
    


        TeamStatusRuleType {
            disabled_status disabled_status
lead_time lead_time
combined_transition combined_transition
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
    


        backoffice_product_type {
            PLAN PLAN
ADDON ADDON
        }
    


        backoffice_product_billing_mode {
            RECURRING RECURRING
LIFETIME LIFETIME
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
    


        notification_type {
            ACTIVITY_MENTION ACTIVITY_MENTION
ACTIVITY_REACTION ACTIVITY_REACTION
TEAM_MEMBER_ADDED TEAM_MEMBER_ADDED
TEAM_MEMBER_REMOVED TEAM_MEMBER_REMOVED
LEAD_SCHEDULE_CREATED LEAD_SCHEDULE_CREATED
LEAD_PROPOSAL_PENDING LEAD_PROPOSAL_PENDING
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
    


        email_credit_plan {
            starter starter
plus plus
pro pro
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
canceled canceled
failed failed
        }
    


        email_log_status {
            queued queued
sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
failed failed
        }
    


        email_event_type {
            sent sent
delivered delivered
opened opened
clicked clicked
bounced bounced
complained complained
delivery_delayed delivery_delayed
unsubscribed unsubscribed
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
    Boolean canCreateAccountUsers 
    Boolean canManageAccountTeams 
    Boolean hasPermanentSubscription 
    Boolean googleCalendarConnected 
    String googleAccessToken "❓"
    String googleRefreshToken "❓"
    DateTime googleTokenExpiresAt "❓"
    String googleEmail "❓"
    String asaasCustomerId "❓"
    String subscriptionId "❓"
    SubscriptionStatus subscriptionStatus "❓"
    SubscriptionPlan subscriptionPlan "❓"
    Int operatorCount 
    DateTime subscriptionStartDate "❓"
    DateTime subscriptionEndDate "❓"
    DateTime trialEndDate "❓"
    String asaasSubscriptionId "❓"
    DateTime subscriptionNextDueDate "❓"
    String subscriptionCycle "❓"
    String activeTeamId "❓"
    String timezone 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_health_plan_options" {
    String id "🗝️"
    String name 
    String normalizedName 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_users" {
    String id "🗝️"
    String email 
    Boolean fullAccess 
    Boolean isActive 
    Boolean isSdr 
    Boolean isCloser 
    Boolean googleCalendarConnected 
    String googleAccessToken "❓"
    String googleRefreshToken "❓"
    DateTime googleTokenExpiresAt "❓"
    String googleEmail "❓"
    String timezone 
    String mailboxStatus 
    String mailboxAddress "❓"
    DateTime mailboxProvisionedAt "❓"
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
    String meetingExtraGuests 
    DateTime statusEnteredAt 
    DateTime createdAt 
    DateTime updatedAt 
    String como_voce_organiza_seus_leads_e_carteira "❓"
    String quantos_usuarios_em_media_voce_precisa "❓"
    String qual_perfil_se_enquadra_em_seu_momento "❓"
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
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_leads_schedule" {
    String id "🗝️"
    DateTime date 
    String meetingTitle "❓"
    String notes "❓"
    String meetingLink "❓"
    String extraGuests 
    String googleEventId "❓"
    String googleCalendarId "❓"
    BackofficeInviteDispatchStatus inviteDispatchStatus "❓"
    String inviteDispatchProvider "❓"
    Boolean inviteDispatchFallbackUsed 
    DateTime inviteDispatchLastAttemptAt "❓"
    String inviteDispatchLastError "❓"
    Json inviteDispatchLastPayload "❓"
    Boolean isCanceled 
    DateTime canceledAt "❓"
    String canceledByProfileId "❓"
    String cancelReason "❓"
    String createdByProfileId "❓"
    DateTime createdAt 
    DateTime updatedAt 
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
  

  "corretor_studio_leads" {
    String id "🗝️"
    String leadCode 
    LeadStatus status 
    String name 
    String email "❓"
    String phone "❓"
    String cnpj "❓"
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
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_activities" {
    String id "🗝️"
    ActivityType type 
    String body "❓"
    Json payload "❓"
    DateTime createdAt 
    }
  

  "corretor_studio_lead_activity_reactions" {
    String id "🗝️"
    String emoji 
    String emojiUnified 
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
    String extraGuests 
    String googleEventId "❓"
    String googleCalendarId "❓"
    InviteDispatchStatus inviteDispatchStatus "❓"
    Boolean inviteDispatchFallbackUsed 
    DateTime inviteDispatchLastAttemptAt "❓"
    String inviteDispatchLastError "❓"
    Json inviteDispatchLastPayload "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_lead_finalized" {
    String id "🗝️"
    DateTime finalizedDateAt 
    DateTime startDateAt 
    Int duration 
    Decimal amount 
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
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_team_filter_presets" {
    String id "🗝️"
    String name 
    String description "❓"
    Json queryJson 
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
    DateTime createdAt 
    DateTime updatedAt 
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
  

  "corretor_studio_email_templates" {
    String id "🗝️"
    String name 
    String subject 
    String previewText "❓"
    Json mailyJson "❓"
    String html "❓"
    Boolean isArchived 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_contact_lists" {
    String id "🗝️"
    String name 
    String description "❓"
    String csvStoragePath "❓"
    Int totalContacts 
    Boolean isArchived 
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
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "corretor_studio_email_campaigns" {
    String id "🗝️"
    String name 
    EmailCampaignStatus status 
    DateTime scheduledAt "❓"
    DateTime sentAt "❓"
    Int totalRecipients 
    Int totalSent 
    Int totalDelivered 
    Int totalOpened 
    Int totalClicked 
    Int totalBounced 
    Int totalComplained 
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
  

  "backoffice_products" {
    String id "🗝️"
    String name 
    String slug 
    String description "❓"
    BackofficeProductType type 
    BackofficeProductBillingMode billingMode 
    Decimal priceMonthly "❓"
    Decimal priceQuarterly "❓"
    Decimal priceSemiannual "❓"
    Decimal priceLifetime "❓"
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_features" {
    String id "🗝️"
    String slug 
    String name 
    String description "❓"
    BackofficeFeatureAccessMode accessMode 
    BackofficeFeatureAccessLevel defaultAccessLevel 
    Boolean betaEnabled 
    Boolean inheritParentSettings 
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
    Boolean isActive 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "backoffice_product_payment_rules" {
    String id "🗝️"
    BackofficePaymentMethod paymentMethod 
    BackofficeAdhesionBillingCycle billingCycle 
    Decimal price 
    Boolean canInstallment 
    Int maxInstallments 
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
  

  "corretor_studio_profile_subscription_capacities" {
    String id "🗝️"
    Int includedExtraTeams 
    Int includedExtraUsers 
    Int manualAdjustmentExtraTeams 
    Int manualAdjustmentExtraUsers 
    DateTime createdAt 
    DateTime updatedAt 
    }
  
    "corretor_studio_profiles" |o--|| "UserRole" : "enum:role"
    "corretor_studio_profiles" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_profiles" |o--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "corretor_studio_profiles" |o--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "corretor_studio_profiles" |o--|o corretor_studio_profiles : "manager"
    "corretor_studio_profiles" }o--|o google_oauth_connections : "googleConnection"
    "corretor_studio_health_plan_options" }o--|o corretor_studio_profiles : "creator"
    "backoffice_users" |o--|| corretor_studio_profiles : "profile"
    "backoffice_users" }o--|o corretor_studio_profiles : "creator"
    "backoffice_users" }o--|o google_oauth_connections : "googleConnection"
    "backoffice_users" }o--|o corretor_studio_profiles : "linkedCorretorStudioProfile"
    "google_oauth_connections" }o--|o corretor_studio_profiles : "ownerProfile"
    "backoffice_clients" }o--|o corretor_studio_profiles : "creator"
    "backoffice_payments" }o--|| backoffice_clients : "client"
    "backoffice_payments" }o--|o corretor_studio_profiles : "creator"
    "backoffice_leads" |o--|| "BackofficeLeadStatus" : "enum:status"
    "backoffice_leads" |o--|| "BackofficeLeadOrigin" : "enum:origin"
    "backoffice_leads" }o--|o corretor_studio_profiles : "creator"
    "backoffice_leads" |o--|o backoffice_webhook_events : "sourceWebhookEvent"
    "backoffice_leads" }o--|o backoffice_users : "sdrBackofficeUser"
    "backoffice_leads" }o--|o backoffice_users : "closerBackofficeUser"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionPlan" : "enum:plan"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionBillingCycle" : "enum:cycle"
    "backoffice_adhesions" |o--|| "BackofficeAdhesionStatus" : "enum:status"
    "backoffice_adhesions" |o--|| backoffice_leads : "lead"
    "backoffice_adhesions" }o--|o backoffice_users : "sdrBackofficeUser"
    "backoffice_adhesions" }o--|o backoffice_users : "closerBackofficeUser"
    "backoffice_adhesions" }o--|o backoffice_users : "createdByBackofficeUser"
    "backoffice_leads_schedule" |o--|o "BackofficeInviteDispatchStatus" : "enum:inviteDispatchStatus"
    "backoffice_leads_schedule" }o--|| backoffice_leads : "lead"
    "backoffice_leads_schedule" }o--|o backoffice_users : "closer"
    "backoffice_webhook_events" |o--|| "BackofficeWebhookSource" : "enum:source"
    "backoffice_webhook_events" |o--|| "BackofficeWebhookEventStatus" : "enum:status"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookSource" : "enum:source"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookTokenStatus" : "enum:status"
    "backoffice_webhook_tokens" |o--|| "BackofficeWebhookTokenExpiryMode" : "enum:expiryMode"
    "backoffice_webhook_tokens" }o--|| backoffice_users : "generatedBy"
    "backoffice_webhook_request_logs" |o--|| "BackofficeWebhookSource" : "enum:source"
    "corretor_studio_leads" |o--|| "LeadStatus" : "enum:status"
    "corretor_studio_leads" |o--|o "MeetingHeald" : "enum:meetingHeald"
    "corretor_studio_leads" |o--|o "LeadStatus" : "enum:followUpSourceStatus"
    "corretor_studio_leads" }o--|| corretor_studio_profiles : "manager"
    "corretor_studio_leads" }o--|o corretor_studio_teams : "team"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "assignee"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "closer"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "creator"
    "corretor_studio_leads" }o--|o corretor_studio_profiles : "updater"
    "corretor_studio_lead_activities" |o--|| "ActivityType" : "enum:type"
    "corretor_studio_lead_activities" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_activities" }o--|o corretor_studio_profiles : "author"
    "corretor_studio_lead_activity_reactions" }o--|| corretor_studio_lead_activities : "activity"
    "corretor_studio_lead_activity_reactions" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_tasks" |o--|| "TaskType" : "enum:taskType"
    "corretor_studio_tasks" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_tasks" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_tasks" |o--|o corretor_studio_lead_activities : "activity"
    "corretor_studio_task_assignees" |o--|| "TaskAssigneeStatus" : "enum:status"
    "corretor_studio_task_assignees" }o--|| corretor_studio_tasks : "task"
    "corretor_studio_task_assignees" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_leads_schedule" |o--|o "InviteDispatchStatus" : "enum:inviteDispatchStatus"
    "corretor_studio_leads_schedule" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_finalized" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_finalized" }o--|o corretor_studio_profiles : "closer"
    "corretor_studio_lead_finalized_holders" |o--|| corretor_studio_lead_finalized : "leadFinalized"
    "corretor_studio_lead_finalized_dependents" }o--|| corretor_studio_lead_finalized : "leadFinalized"
    "corretor_studio_lead_portfolio" |o--|| "PortfolioStatus" : "enum:portfolioStatus"
    "corretor_studio_lead_portfolio" |o--|| "PortfolioSource" : "enum:source"
    "corretor_studio_lead_portfolio" |o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_portfolio" }o--|| corretor_studio_teams : "team"
    "corretor_studio_lead_attachments" }o--|| corretor_studio_leads : "lead"
    "corretor_studio_lead_attachments" }o--|| corretor_studio_profiles : "uploader"
    "corretor_studio_pending_operators" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_pending_operators" }o--|| corretor_studio_profiles : "manager"
    "corretor_studio_pending_operators" }o--|o corretor_studio_teams : "team"
    "corretor_studio_teams" }o--|| corretor_studio_profiles : "master"
    "corretor_studio_team_filter_presets" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_filter_presets" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_team_status_rules" |o--|| "TeamStatusRuleType" : "enum:type"
    "corretor_studio_team_status_rules" |o--|| "LeadStatus" : "enum:targetStatus"
    "corretor_studio_team_status_rules" |o--|o "LeadStatus" : "enum:requiredStatus"
    "corretor_studio_team_status_rules" |o--|o "TeamLeadTimeUnit" : "enum:leadTimeUnit"
    "corretor_studio_team_status_rules" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_status_rules" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_team_studio_webhook_configs" |o--|| "StudioWebhookTokenExpiryMode" : "enum:expiryMode"
    "corretor_studio_team_studio_webhook_configs" |o--|| corretor_studio_teams : "team"
    "corretor_studio_team_studio_webhook_configs" }o--|| corretor_studio_profiles : "updatedBy"
    "corretor_studio_team_studio_webhook_request_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_notifications" |o--|| "NotificationType" : "enum:type"
    "corretor_studio_notifications" }o--|| corretor_studio_profiles : "recipient"
    "corretor_studio_notifications" }o--|o corretor_studio_profiles : "actor"
    "corretor_studio_notifications" }o--|| corretor_studio_teams : "team"
    "corretor_studio_pending_actions" |o--|| "PendingActionType" : "enum:actionType"
    "corretor_studio_pending_actions" |o--|| "PendingActionStatus" : "enum:status"
    "corretor_studio_pending_actions" }o--|| corretor_studio_profiles : "master"
    "corretor_studio_pending_actions" }o--|o corretor_studio_teams : "team"
    "corretor_studio_team_members" |o--|| "UserRole" : "enum:role"
    "corretor_studio_team_members" |o--}o "UserFunction" : "enum:functions"
    "corretor_studio_team_members" }o--|| corretor_studio_teams : "team"
    "corretor_studio_team_members" }o--|| corretor_studio_profiles : "profile"
    "corretor_studio_email_credit_subscriptions" |o--|| "EmailCreditPlan" : "enum:plan"
    "corretor_studio_email_credit_subscriptions" |o--|| "EmailCreditSubscriptionStatus" : "enum:status"
    "corretor_studio_email_credit_subscriptions" |o--|| corretor_studio_profiles : "profile"
    "corretor_studio_email_credit_usages" }o--|| corretor_studio_email_credit_subscriptions : "subscription"
    "corretor_studio_email_templates" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_templates" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_contact_lists" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_contact_lists" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_contacts" }o--|| corretor_studio_email_contact_lists : "list"
    "corretor_studio_email_campaigns" |o--|| "EmailCampaignStatus" : "enum:status"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_profiles : "creator"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_email_templates : "template"
    "corretor_studio_email_campaigns" }o--|| corretor_studio_email_contact_lists : "contactList"
    "corretor_studio_email_logs" |o--|| "EmailLogStatus" : "enum:status"
    "corretor_studio_email_logs" }o--|| corretor_studio_teams : "team"
    "corretor_studio_email_logs" }o--|o corretor_studio_email_campaigns : "campaign"
    "corretor_studio_email_events" |o--|| "EmailEventType" : "enum:type"
    "corretor_studio_email_events" }o--|| corretor_studio_email_logs : "log"
    "backoffice_products" |o--|| "BackofficeProductType" : "enum:type"
    "backoffice_products" |o--|| "BackofficeProductBillingMode" : "enum:billingMode"
    "backoffice_features" |o--|| "BackofficeFeatureAccessMode" : "enum:accessMode"
    "backoffice_features" |o--|| "BackofficeFeatureAccessLevel" : "enum:defaultAccessLevel"
    "backoffice_features" |o--|o backoffice_features : "parent"
    "backoffice_features" }o--|o backoffice_products : "product"
    "backoffice_feature_access_rules" |o--|| "BackofficeAccessPrincipal" : "enum:principal"
    "backoffice_feature_access_rules" |o--|| "BackofficeFeatureAccessLevel" : "enum:accessLevel"
    "backoffice_feature_access_rules" }o--|| backoffice_features : "feature"
    "backoffice_feature_grants" |o--|| "BackofficeFeatureGrantType" : "enum:grantType"
    "backoffice_feature_grants" |o--|| "BackofficeFeatureAccessLevel" : "enum:accessLevel"
    "backoffice_feature_grants" }o--|| backoffice_features : "feature"
    "backoffice_feature_grants" }o--|| corretor_studio_profiles : "profile"
    "backoffice_product_payment_rules" |o--|| "BackofficePaymentMethod" : "enum:paymentMethod"
    "backoffice_product_payment_rules" |o--|| "BackofficeAdhesionBillingCycle" : "enum:billingCycle"
    "backoffice_product_payment_rules" }o--|| backoffice_products : "product"
    "backoffice_user_subscriptions" |o--|| "BackofficeSubscriptionStatus" : "enum:status"
    "backoffice_user_subscriptions" |o--|o "BackofficeAdhesionBillingCycle" : "enum:cycle"
    "backoffice_user_subscriptions" }o--|| corretor_studio_profiles : "profile"
    "backoffice_user_subscriptions" }o--|| backoffice_products : "product"
    "corretor_studio_profile_subscriptions" |o--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "corretor_studio_profile_subscriptions" |o--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "corretor_studio_profile_subscriptions" |o--|| corretor_studio_profiles : "profile"
    "corretor_studio_profile_subscriptions" |o--|o backoffice_adhesions : "adhesion"
    "corretor_studio_profile_subscriptions" }o--|o backoffice_products : "product"
    "corretor_studio_profile_subscription_capacities" |o--|| corretor_studio_profile_subscriptions : "profileSubscription"
```
