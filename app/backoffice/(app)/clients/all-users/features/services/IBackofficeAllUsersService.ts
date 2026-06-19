import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
  BackofficeAllUsersScheduleFilters,
  BackofficeAllUsersScheduleListResult,
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

  getSchedules(
    profileId: string,
    params?: {
      filters?: Partial<BackofficeAllUsersScheduleFilters>
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeAllUsersScheduleListResult>

  sendAccessEmail(
    memberId: string,
    mode: "invite" | "reset_password"
  ): Promise<{ email: string }>

  updateUserType(profileId: string, data: BackofficeAllUsersUpdateUserTypeInput): Promise<BackofficeAllUsersUserType>
}
