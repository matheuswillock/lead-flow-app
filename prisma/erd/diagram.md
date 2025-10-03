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
    


        AgeRange {
            RANGE_0_18 0-18
RANGE_19_25 19-25
RANGE_26_35 26-35
RANGE_36_45 36-45
RANGE_46_60 46-60
RANGE_61_PLUS 61+
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
    String profileIconId "❓"
    String profileIconUrl "❓"
    UserRole role 
    String asaasCustomerId "❓"
    String subscriptionId "❓"
    SubscriptionStatus subscriptionStatus "❓"
    SubscriptionPlan subscriptionPlan "❓"
    Int operatorCount 
    DateTime subscriptionStartDate "❓"
    DateTime subscriptionEndDate "❓"
    DateTime trialEndDate "❓"
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
    AgeRange age 
    Boolean hasHealthPlan "❓"
    String currentHealthPlan "❓"
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
    "leads" o|--|| "LeadStatus" : "enum:status"
    "leads" o|--}o "AgeRange" : "enum:age"
    "leads" o|--|| "profiles" : "manager"
    "leads" o|--|o "profiles" : "assignee"
    "leads" o|--|o "profiles" : "creator"
    "leads" o|--|o "profiles" : "updater"
    "leads" o{--}o "lead_activities" : "activities"
    "leads" o{--}o "leads_schedule" : "LeadsSchedule"
    "leads" o{--}o "lead_finalized" : "LeadFinalized"
    "lead_activities" o|--|| "ActivityType" : "enum:type"
    "lead_activities" o|--|| "leads" : "lead"
    "lead_activities" o|--|o "profiles" : "author"
    "leads_schedule" o|--|| "leads" : "lead"
    "lead_finalized" o|--|| "leads" : "lead"
```
