import type {
  BackofficeAnathemaItem,
  BackofficeAnathemasFilters,
  BackofficeAnathemasListResult,
} from "../context/BackofficeAnathemasTypes"

export interface IBackofficeAnathemasService {
  list(params?: {
    filters?: Partial<BackofficeAnathemasFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAnathemasListResult>
  banUser(profileId: string, reason?: string | null): Promise<BackofficeAnathemaItem>
  liftBan(banId: string, liftReason?: string | null): Promise<BackofficeAnathemaItem>
}
