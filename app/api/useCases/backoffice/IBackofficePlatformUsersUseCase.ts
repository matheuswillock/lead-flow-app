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
}
