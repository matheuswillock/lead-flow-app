import type {
  BackofficeClientDetails,
  BackofficeClientInvoiceFilters,
  BackofficeClientInvoicesResult,
  BackofficeClientPendingActionsResult,
} from "../context/BackofficeClientDetailsTypes"

export interface BackofficeMutationPendingPayment {
  requiresPayment: true
  pendingActionId: string
  checkoutUrl: string
  totalCharge: number
  remainingMonths: number
}

export type BackofficeMutationResult =
  | { kind: "completed" }
  | ({ kind: "pending_payment" } & BackofficeMutationPendingPayment)

export interface IBackofficeClientDetailsService {
  sendAccessEmail(input: {
    memberId: string
    accountMasterId: string
    mode: "invite" | "reset_password"
  }): Promise<{ email: string }>

  generateInviteLink(input: {
    memberId: string
    accountMasterId: string
  }): Promise<{ actionLink: string; email: string }>

  getByMasterId(
    masterId: string,
    options?: {
      query?: string
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeClientDetails>

  getInvoicesByMasterId(
    masterId: string,
    options?: {
      page?: number
      pageSize?: number
      status?: BackofficeClientInvoiceFilters["status"]
      period?: BackofficeClientInvoiceFilters["period"]
      timezone?: string
    }
  ): Promise<BackofficeClientInvoicesResult>

  getPendingActionsByMasterId(masterId: string): Promise<BackofficeClientPendingActionsResult>

  cancelPendingAction(
    masterId: string,
    pendingActionId: string
  ): Promise<{ message: string }>

  updateClient(
    masterId: string,
    data: {
      fullName?: string
      phone?: string | null
      cpfCnpj?: string | null
      postalCode?: string | null
      address?: string | null
      addressNumber?: string | null
      neighborhood?: string | null
      complement?: string | null
      city?: string | null
      state?: string | null
      functions?: string[]
      hasPermanentSubscription?: boolean
      hasUnlimitedUsers?: boolean
      multiskillEnabled?: boolean
    }
  ): Promise<void>

  updateUserType(
    masterId: string,
    data: {
      userType: "common" | "member_pro"
      accessExpiresAt?: string
    }
  ): Promise<void>

  banUser(profileId: string, reason?: string | null): Promise<void>

  deleteClient(masterId: string): Promise<void>

  updateMember(
    memberId: string,
    data: {
      fullName?: string
      phone?: string | null
      email?: string
      role?: "manager" | "backoffice" | "operator"
      functions?: ("SDR" | "CLOSER")[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
      teamId?: string
      accountMasterId?: string
    }
  ): Promise<void>

  deleteMember(memberId: string, password: string): Promise<void>

  removeMemberFromTeam(memberId: string, teamId: string): Promise<void>

  addMemberToTeam(
    memberId: string,
    teamId: string,
    access?: {
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      canCreateAccountUsers: boolean
      canManageAccountTeams: boolean
      canTransferAccountLeads: boolean
      canViewAllTeams: boolean
    }
  ): Promise<void>

  getMemberGoogleScopes(memberId: string): Promise<{ connected: boolean; scopes: string[] }>

  getMemberExternalTeams(
    memberId: string,
    accountMasterId: string
  ): Promise<
    Array<{
      teamId: string
      teamName: string
      accountMasterId: string
      accountName: string
      role: string
    }>
  >

  getMemberAccountTeams(
    memberId: string,
    accountMasterId: string
  ): Promise<
    Array<{
      teamId: string
      teamName: string
      membersCount: number
      isMember: boolean
      role?: string
      functions?: string[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      canViewAllTeams?: boolean
    }>
  >

  addMember(
    masterId: string,
    data: {
      fullName: string
      email: string
      phone?: string | null
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      teamId: string
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
      generateCharge?: boolean
    }
  ): Promise<BackofficeMutationResult>

  addTeam(
    masterId: string,
    data: { name: string; generateCharge?: boolean }
  ): Promise<BackofficeMutationResult>

  addMasterToTeam(masterId: string, teamId: string): Promise<void>

  updateTeam(
    masterId: string,
    teamId: string,
    data: { name?: string; transferTargetTeamIds?: string[] }
  ): Promise<void>

  deleteTeam(masterId: string, teamId: string): Promise<void>
}
