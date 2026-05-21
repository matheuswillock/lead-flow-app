import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
} from "../context/BackofficeAllUsersTypes"

export interface IBackofficeAllUsersService {
  list(params?: {
    filters?: Partial<BackofficeAllUsersFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAllUsersListResult>

  getDetail(profileId: string): Promise<BackofficeAllUsersDetail>
}
