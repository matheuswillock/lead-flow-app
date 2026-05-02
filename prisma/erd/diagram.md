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
    


        backoffice_subscription_status {
            active active
suspended suspended
canceled canceled
expired expired
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
    
  "profiles" {
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
  

  "health_plan_options" {
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
    String asaasCustomerId "❓"
    String asaasPaymentId "❓"
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
  

  "leads" {
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
  

  "lead_activities" {
    String id "🗝️"
    ActivityType type 
    String body "❓"
    Json payload "❓"
    DateTime createdAt 
    }
  

  "lead_activity_reactions" {
    String id "🗝️"
    String emoji 
    String emojiUnified 
    DateTime createdAt 
    }
  

  "leads_schedule" {
    String id "🗝️"
    DateTime date 
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
  

  "lead_finalized" {
    String id "🗝️"
    DateTime finalizedDateAt 
    DateTime startDateAt 
    Int duration 
    Decimal amount 
    String notes "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "lead_portfolio" {
    String id "🗝️"
    PortfolioStatus portfolioStatus 
    String note "❓"
    DateTime lastContactAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "lead_attachments" {
    String id "🗝️"
    String fileName 
    String fileUrl 
    String storagePath 
    String fileType 
    Int fileSize 
    DateTime uploadedAt 
    }
  

  "pending_operators" {
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
  

  "teams" {
    String id "🗝️"
    String name 
    Boolean isDefault 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "team_filter_presets" {
    String id "🗝️"
    String name 
    String description "❓"
    Json queryJson 
    DateTime lastUsedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "team_status_rules" {
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
  

  "team_studio_webhook_configs" {
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
  

  "team_studio_webhook_request_logs" {
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
  

  "notifications" {
    String id "🗝️"
    NotificationType type 
    String message 
    Json metadata "❓"
    Boolean isRead 
    DateTime readAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "pending_actions" {
    String id "🗝️"
    PendingActionType actionType 
    PendingActionStatus status 
    Json payload 
    String checkoutId "❓"
    String paymentId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "team_members" {
    String id "🗝️"
    UserRole role 
    UserFunction functions 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "email_credit_subscriptions" {
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
  

  "email_credit_usages" {
    String id "🗝️"
    DateTime periodStart 
    DateTime periodEnd 
    Int creditsUsed 
    Int overageCount 
    Decimal overageCharged 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "email_templates" {
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
  

  "email_contact_lists" {
    String id "🗝️"
    String name 
    String description "❓"
    String csvStoragePath "❓"
    Int totalContacts 
    Boolean isArchived 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "email_contacts" {
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
  

  "email_campaigns" {
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
  

  "email_logs" {
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
  

  "email_events" {
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
  
    "profiles" |o--|| "UserRole" : "enum:role"
    "profiles" |o--}o "UserFunction" : "enum:functions"
    "profiles" |o--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "profiles" |o--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "profiles" |o--|o profiles : "manager"
    "health_plan_options" }o--|o profiles : "creator"
    "backoffice_users" |o--|| profiles : "profile"
    "backoffice_users" }o--|o profiles : "creator"
    "backoffice_clients" }o--|o profiles : "creator"
    "backoffice_payments" }o--|| backoffice_clients : "client"
    "backoffice_payments" }o--|o profiles : "creator"
    "backoffice_leads" |o--|| "BackofficeLeadStatus" : "enum:status"
    "backoffice_leads" |o--|| "BackofficeLeadOrigin" : "enum:origin"
    "backoffice_leads" }o--|o profiles : "creator"
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
    "leads" |o--|| "LeadStatus" : "enum:status"
    "leads" |o--|o "MeetingHeald" : "enum:meetingHeald"
    "leads" |o--|o "LeadStatus" : "enum:followUpSourceStatus"
    "leads" }o--|| profiles : "manager"
    "leads" }o--|o teams : "team"
    "leads" }o--|o profiles : "assignee"
    "leads" }o--|o profiles : "closer"
    "leads" }o--|o profiles : "creator"
    "leads" }o--|o profiles : "updater"
    "lead_activities" |o--|| "ActivityType" : "enum:type"
    "lead_activities" }o--|| leads : "lead"
    "lead_activities" }o--|o profiles : "author"
    "lead_activity_reactions" }o--|| lead_activities : "activity"
    "lead_activity_reactions" }o--|| profiles : "profile"
    "leads_schedule" |o--|o "InviteDispatchStatus" : "enum:inviteDispatchStatus"
    "leads_schedule" }o--|| leads : "lead"
    "lead_finalized" }o--|| leads : "lead"
    "lead_portfolio" |o--|| "PortfolioStatus" : "enum:portfolioStatus"
    "lead_portfolio" |o--|| leads : "lead"
    "lead_portfolio" }o--|| teams : "team"
    "lead_attachments" }o--|| leads : "lead"
    "lead_attachments" }o--|| profiles : "uploader"
    "pending_operators" |o--}o "UserFunction" : "enum:functions"
    "pending_operators" }o--|| profiles : "manager"
    "pending_operators" }o--|o teams : "team"
    "teams" }o--|| profiles : "master"
    "team_filter_presets" }o--|| teams : "team"
    "team_filter_presets" }o--|| profiles : "creator"
    "team_status_rules" |o--|| "TeamStatusRuleType" : "enum:type"
    "team_status_rules" |o--|| "LeadStatus" : "enum:targetStatus"
    "team_status_rules" |o--|o "LeadStatus" : "enum:requiredStatus"
    "team_status_rules" |o--|o "TeamLeadTimeUnit" : "enum:leadTimeUnit"
    "team_status_rules" }o--|| teams : "team"
    "team_status_rules" }o--|| profiles : "creator"
    "team_studio_webhook_configs" |o--|| "StudioWebhookTokenExpiryMode" : "enum:expiryMode"
    "team_studio_webhook_configs" |o--|| teams : "team"
    "team_studio_webhook_configs" }o--|| profiles : "updatedBy"
    "team_studio_webhook_request_logs" }o--|| teams : "team"
    "notifications" |o--|| "NotificationType" : "enum:type"
    "notifications" }o--|| profiles : "recipient"
    "notifications" }o--|o profiles : "actor"
    "notifications" }o--|| teams : "team"
    "pending_actions" |o--|| "PendingActionType" : "enum:actionType"
    "pending_actions" |o--|| "PendingActionStatus" : "enum:status"
    "pending_actions" }o--|| profiles : "master"
    "pending_actions" }o--|o teams : "team"
    "team_members" |o--|| "UserRole" : "enum:role"
    "team_members" |o--}o "UserFunction" : "enum:functions"
    "team_members" }o--|| teams : "team"
    "team_members" }o--|| profiles : "profile"
    "email_credit_subscriptions" |o--|| "EmailCreditPlan" : "enum:plan"
    "email_credit_subscriptions" |o--|| "EmailCreditSubscriptionStatus" : "enum:status"
    "email_credit_subscriptions" |o--|| profiles : "profile"
    "email_credit_usages" }o--|| email_credit_subscriptions : "subscription"
    "email_templates" }o--|| teams : "team"
    "email_templates" }o--|| profiles : "creator"
    "email_contact_lists" }o--|| teams : "team"
    "email_contact_lists" }o--|| profiles : "creator"
    "email_contacts" }o--|| email_contact_lists : "list"
    "email_campaigns" |o--|| "EmailCampaignStatus" : "enum:status"
    "email_campaigns" }o--|| teams : "team"
    "email_campaigns" }o--|| profiles : "creator"
    "email_campaigns" }o--|| email_templates : "template"
    "email_campaigns" }o--|| email_contact_lists : "contactList"
    "email_logs" |o--|| "EmailLogStatus" : "enum:status"
    "email_logs" }o--|| teams : "team"
    "email_logs" }o--|o email_campaigns : "campaign"
    "email_events" |o--|| "EmailEventType" : "enum:type"
    "email_events" }o--|| email_logs : "log"
    "backoffice_products" |o--|| "BackofficeProductType" : "enum:type"
    "backoffice_products" |o--|| "BackofficeProductBillingMode" : "enum:billingMode"
    "backoffice_user_subscriptions" |o--|| "BackofficeSubscriptionStatus" : "enum:status"
    "backoffice_user_subscriptions" |o--|o "BackofficeAdhesionBillingCycle" : "enum:cycle"
    "backoffice_user_subscriptions" }o--|| profiles : "profile"
    "backoffice_user_subscriptions" }o--|| backoffice_products : "product"
```
