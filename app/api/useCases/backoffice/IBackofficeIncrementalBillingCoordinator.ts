import type { BillingOwnerProfile } from "@/app/api/services/billing/IIncrementalBillingService"

export interface BackofficePendingChargeResult {
  pendingActionId: string
  checkoutUrl: string
  totalCharge: number
  remainingMonths: number
  billingType: "PIX" | "CREDIT_CARD"
}

export interface BackofficeAddUserPendingInput {
  master: BillingOwnerProfile
  teamId: string
  fullName: string
  email: string
  role: "manager" | "backoffice" | "operator"
  functions: ("SDR" | "CLOSER")[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
}

export interface BackofficeCreateTeamPendingInput {
  master: BillingOwnerProfile
  teamName: string
  masterFunctions: ("SDR" | "CLOSER")[]
}

export interface BackofficeAddMemberPendingInput {
  master: BillingOwnerProfile
  teamId: string
  profileId: string
  profileEmail: string
  profileName: string
  role: "manager" | "backoffice" | "operator"
  functions: ("SDR" | "CLOSER")[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  initiatedBy?: "backoffice" | "product"
}

export interface IBackofficeIncrementalBillingCoordinator {
  assertChargeableMaster(master: BillingOwnerProfile): string | null
  createAddUserPendingAction(
    input: BackofficeAddUserPendingInput
  ): Promise<BackofficePendingChargeResult>
  createAddMemberPendingAction(
    input: BackofficeAddMemberPendingInput
  ): Promise<BackofficePendingChargeResult>
  createCreateTeamPendingAction(
    input: BackofficeCreateTeamPendingInput
  ): Promise<BackofficePendingChargeResult>
}
