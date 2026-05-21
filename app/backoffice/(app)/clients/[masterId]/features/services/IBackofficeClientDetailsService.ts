import type {
  BackofficeClientDetails,
  BackofficeClientInvoiceFilters,
  BackofficeClientInvoicesResult,
} from "../context/BackofficeClientDetailsTypes"

export interface IBackofficeClientDetailsService {
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
    }
  ): Promise<void>

  deleteClient(masterId: string): Promise<void>

  updateMember(
    memberId: string,
    data: { fullName?: string; phone?: string | null; email?: string }
  ): Promise<void>

  deleteMember(memberId: string, password: string): Promise<void>

  removeMemberFromTeam(memberId: string, teamId: string): Promise<void>

  getMemberGoogleScopes(memberId: string): Promise<{ connected: boolean; scopes: string[] }>
}
