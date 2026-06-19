import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
  BackofficeAllUsersUserType,
  BackofficeAllUsersUserTypeFilter,
} from "../context/BackofficeAllUsersTypes"

export interface BackofficeAllUsersUpdateUserTypeInput {
  userType: BackofficeAllUsersUserTypeFilter
  accessExpiresAt?: string
}

export interface IBackofficeAllUsersService {
  list(params?: {
    filters?: Partial<BackofficeAllUsersFilters>
    page?: number
    pageSize?: number
  }): Promise<BackofficeAllUsersListResult>

  getDetail(profileId: string): Promise<BackofficeAllUsersDetail>

  sendAccessEmail(
    memberId: string,
    mode: "invite" | "reset_password"
  ): Promise<{ email: string }>

  updateUserType(profileId: string, data: BackofficeAllUsersUpdateUserTypeInput): Promise<BackofficeAllUsersUserType>
}
