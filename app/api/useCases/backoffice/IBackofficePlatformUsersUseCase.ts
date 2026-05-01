import type { Output } from "@/lib/output"

export interface IBackofficePlatformUsersUseCase {
  listMasterUsers(
    filters: { name?: string; email?: string; team?: string } | undefined,
    pagination: { page: number; pageSize: number }
  ): Promise<Output>

  getMasterUserDetails(
    masterProfileId: string,
    options: { query?: string; page: number; pageSize: number }
  ): Promise<Output>

  getMasterUserInvoices(
    masterProfileId: string,
    options: {
      page: number
      pageSize: number
      status?: string
      period?: string
      timezone?: string
    }
  ): Promise<Output>

  getMasterUserInvoiceById(
    masterProfileId: string,
    invoiceId: string
  ): Promise<Output>

  notifyMasterUserInvoiceStatusEmail(
    masterProfileId: string,
    invoiceId: string
  ): Promise<Output>

  updateMasterUser(
    masterProfileId: string,
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
    }
  ): Promise<Output>

  deleteMasterUser(masterProfileId: string): Promise<Output>
}
