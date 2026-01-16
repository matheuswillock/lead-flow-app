```mermaid
erDiagram

        UserRole {
            manager manager
operator operator
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
    String complement "❓"
    String city "❓"
    String state "❓"
    String profileIconId "❓"
    String profileIconUrl "❓"
    UserRole role 
    Boolean isMaster 
    Boolean hasPermanentSubscription 
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
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "leads" {
    String id "🗝️"
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
    String notes "❓"
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
    String notes "❓"
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
    String paymentId "❓"
    String subscriptionId "❓"
    String paymentStatus 
    String paymentMethod 
    Boolean operatorCreated 
    String operatorId "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  
    "profiles" o|--|| "UserRole" : "enum:role"
    "profiles" o|--|o "SubscriptionStatus" : "enum:subscriptionStatus"
    "profiles" o|--|o "SubscriptionPlan" : "enum:subscriptionPlan"
    "profiles" o|--|o "profiles" : "manager"
    "profiles" o{--}o "profiles" : "operators"
    "profiles" o{--}o "leads" : "leadsAsManager"
    "profiles" o{--}o "leads" : "leadsAsAssignee"
    "profiles" o{--}o "leads" : "leadsAsCreator"
    "profiles" o{--}o "leads" : "leadsAsUpdater"
    "profiles" o{--}o "lead_activities" : "activities"
    "profiles" o{--}o "lead_attachments" : "attachments"
    "profiles" o{--}o "pending_operators" : "pendingOperators"
    "leads" o|--|| "LeadStatus" : "enum:status"
    "leads" o|--|o "HealthPlan" : "enum:currentHealthPlan"
    "leads" o|--|| "profiles" : "manager"
    "leads" o|--|o "profiles" : "assignee"
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
    "pending_operators" o|--|| "profiles" : "manager"
```
