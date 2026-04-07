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
    }
  ): Promise<BackofficeClientInvoicesResult>
}
