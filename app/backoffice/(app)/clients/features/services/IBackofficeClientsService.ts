import type {
  BackofficeClientsFilters,
  BackofficeClientsListResult,
} from "../context/BackofficeClientsTypes"

export interface IBackofficeClientsService {
  list(params?: {
    filters?: Partial<BackofficeClientsFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeClientsListResult>
}
