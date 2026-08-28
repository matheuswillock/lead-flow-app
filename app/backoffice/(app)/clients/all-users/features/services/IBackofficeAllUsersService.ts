import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersListResult,
  BackofficeAllUsersScheduleFilters,
  BackofficeAllUsersScheduleListResult,
  BackofficeAllUsersEmailDispatchFilters,
  BackofficeAllUsersEmailDispatchListResult,
  BackofficeAllUsersUserType,
  BackofficeAllUsersUserTypeFilter,
  BackofficeSponsorMasterOption,
} from "../context/BackofficeAllUsersTypes"

export interface BackofficeAllUsersUpdateUserTypeInput {
  userType: BackofficeAllUsersUserTypeFilter
  accessExpiresAt?: string
  sponsorMasterId?: string
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

  getEmailDispatches(
    profileId: string,
    params?: {
      filters?: Partial<BackofficeAllUsersEmailDispatchFilters>
      page?: number
      pageSize?: number
    }
  ): Promise<BackofficeAllUsersEmailDispatchListResult>

  sendAccessEmail(input: {
    memberId: string
    accountMasterId: string
    mode: "invite" | "reset_password"
  }): Promise<{ email: string }>

  updateUserType(profileId: string, data: BackofficeAllUsersUpdateUserTypeInput): Promise<BackofficeAllUsersUserType>

  listSponsorMasters(): Promise<BackofficeSponsorMasterOption[]>

  banUser(profileId: string, reason?: string | null): Promise<void>
}
