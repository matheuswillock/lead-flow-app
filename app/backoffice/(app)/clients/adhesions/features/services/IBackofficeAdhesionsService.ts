import type {
  BackofficeAdhesionCreationResult,
  BackofficeAdhesionFilters,
  BackofficeAdhesionFormValues,
  BackofficeAdhesionListResult,
  BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"

export interface IBackofficeAdhesionsService {
  list(params?: {
    filters?: Partial<BackofficeAdhesionFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAdhesionListResult>
  getOptions(): Promise<BackofficeAdhesionOptions>
  create(
    values: BackofficeAdhesionFormValues & { accessExpiresAt?: string | null }
  ): Promise<BackofficeAdhesionCreationResult>
  update(id: string, values: Partial<Omit<BackofficeAdhesionFormValues, "leadId">>): Promise<void>
  deletePending(id: string): Promise<void>
  resend(id: string): Promise<BackofficeAdhesionCreationResult>
  getPublicUrl(id: string): Promise<{ publicUrl: string; expiresAt: string }>
  resendInvite(id: string): Promise<void>
}
