```mermaid
erDiagram

        UserRole {
            manager manager
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
    


        ActivityType {
            note note
call call
whatsapp whatsapp
email email
status_change status_change
        }
    


        HealthPlan {
            NOVA_ADESAO Nova Adesão
AMIL Amil
BRADESCO Bradesco
HAPVIDA Hapvida
MEDSENIOR MedSênior
GNDI NotreDame Intermédica (GNDI)
OMINT Omint
PLENA Plena
PORTO_SEGURO Porto Seguro
PREVENT_SENIOR Prevent Senior
SULAMERICA SulAmérica
UNIMED Unimed
OUTROS Outros
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
    DateTime createdAt 
    DateTime updatedAt 
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
    HealthPlan currentHealthPlan "❓"
    Decimal currentValue "❓"
    String referenceHospital "❓"
    String currentTreatment "❓"
    DateTime meetingDate "❓"
    String meetingTitle "❓"
    String meetingNotes "❓"
    String meetingLink "❓"
    MeetingHeald meetingHeald "❓"
    String notes "❓"
    Decimal ticket "❓"
    DateTime contractDueDate "❓"
    HealthPlan soldPlan "❓"
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
  

  "leads_schedule" {
    String id "🗝️"
    DateTime date 
    String meetingTitle "❓"
    String notes "❓"
    String meetingLink "❓"
    String extraGuests 
    String googleEventId "❓"
    String googleCalendarId "❓"
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
  
    "profiles" o|--|| "UserRole" : "enum:role"
    "profiles" o|--}o "UserFunction" : "enum:functions"
    "profiles" o|--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "profiles" o|--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "profiles" o|--|o "profiles" : "manager"
    "profiles" o{--}o "profiles" : "operators"
    "profiles" o{--}o "leads" : "leadsAsManager"
    "profiles" o{--}o "leads" : "leadsAsAssignee"
    "profiles" o{--}o "leads" : "leadsAsCloser"
    "profiles" o{--}o "leads" : "leadsAsCreator"
    "profiles" o{--}o "leads" : "leadsAsUpdater"
    "profiles" o{--}o "lead_activities" : "activities"
    "profiles" o{--}o "lead_attachments" : "attachments"
    "profiles" o{--}o "pending_operators" : "pendingOperators"
    "profiles" o{--}o "pending_actions" : "pendingActions"
    "profiles" o{--}o "teams" : "teamsOwned"
    "profiles" o{--}o "team_members" : "teamMemberships"
    "leads" o|--|| "LeadStatus" : "enum:status"
    "leads" o|--|o "HealthPlan" : "enum:currentHealthPlan"
    "leads" o|--|o "MeetingHeald" : "enum:meetingHeald"
    "leads" o|--|o "HealthPlan" : "enum:soldPlan"
    "leads" o|--|| "profiles" : "manager"
    "leads" o|--|o "teams" : "team"
    "leads" o|--|o "profiles" : "assignee"
    "leads" o|--|o "profiles" : "closer"
    "leads" o|--|o "profiles" : "creator"
    "leads" o|--|o "profiles" : "updater"
    "leads" o{--}o "lead_activities" : "activities"
    "leads" o{--}o "leads_schedule" : "LeadsSchedule"
    "leads" o{--}o "lead_finalized" : "LeadFinalized"
    "leads" o{--}o "lead_attachments" : "attachments"
    "lead_activities" o|--|| "ActivityType" : "enum:type"
    "lead_activities" o|--|| "leads" : "lead"
    "lead_activities" o|--|o "profiles" : "author"
    "leads_schedule" o|--|| "leads" : "lead"
    "lead_finalized" o|--|| "leads" : "lead"
    "lead_attachments" o|--|| "leads" : "lead"
    "lead_attachments" o|--|| "profiles" : "uploader"
    "pending_operators" o|--}o "UserFunction" : "enum:functions"
    "pending_operators" o|--|| "profiles" : "manager"
    "pending_operators" o|--|o "teams" : "team"
    "teams" o|--|| "profiles" : "master"
    "teams" o{--}o "team_members" : "members"
    "teams" o{--}o "leads" : "leads"
    "teams" o{--}o "pending_operators" : "pendingOperators"
    "teams" o{--}o "pending_actions" : "pendingActions"
    "pending_actions" o|--|| "PendingActionType" : "enum:actionType"
    "pending_actions" o|--|| "PendingActionStatus" : "enum:status"
    "pending_actions" o|--|| "profiles" : "master"
    "pending_actions" o|--|o "teams" : "team"
    "team_members" o|--|| "UserRole" : "enum:role"
    "team_members" o|--}o "UserFunction" : "enum:functions"
    "team_members" o|--|| "teams" : "team"
    "team_members" o|--|| "profiles" : "profile"
```
