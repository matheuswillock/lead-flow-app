import type { SubscriptionPlan, UserFunction, UserRole } from "@prisma/client"
import type { ScheduleMeetingStatus } from "@/lib/lead-meeting"

export type BackofficeScheduleFunction = "sdr" | "closer"

export type BackofficeAllUsersRoleFilter = "master" | "manager" | "operator"
export type BackofficeAllUsersPlanFilter = "lifetime" | "monthly" | "trial" | "none"
export type BackofficeAllUsersUserTypeFilter = "common" | "member_pro"

export interface BackofficeAllUsersFiltersInput {
  query?: string
  role?: BackofficeAllUsersRoleFilter
  plan?: BackofficeAllUsersPlanFilter
  userType?: BackofficeAllUsersUserTypeFilter
}

export interface BackofficeAllUsersUserTypeRef {
  slug: "common" | "member_pro"
  label: string
  accessExpiresAt: string | null
  isExpired: boolean
}

export interface BackofficeUpsertUserTypeAssignmentInput {
  userType: "common" | "member_pro"
  accessExpiresAt: Date | null
  assignedByProfileId: string | null
}

export interface BackofficeAllUsersPaginationInput {
  page: number
  pageSize: number
}

export interface BackofficeAllUsersMasterRef {
  id: string
  fullName: string | null
  hasPermanentSubscription: boolean
  subscriptionPlan: SubscriptionPlan | null
  operatorCount: number
}

export interface BackofficeAllUsersListRecord {
  id: string
  supabaseId: string | null
  fullName: string | null
  email: string
  phone: string | null
  role: UserRole
  functions: UserFunction[]
  isMaster: boolean
  googleCalendarConnected: boolean
  createdAt: Date
  master: BackofficeAllUsersMasterRef | null
  userType: BackofficeAllUsersUserTypeRef
}

export interface BackofficeAllUsersDetailRecord extends BackofficeAllUsersListRecord {
  googleEmail: string | null
  teams: Array<{
    id: string
    name: string
    createdAt: Date
    membersCount: number
    masterId: string
    masterFullName: string | null
  }>
}

export interface BackofficeAllUsersScheduleMemberRef {
  id: string
  fullName: string | null
  email: string
}

export interface BackofficeAllUsersScheduleTransferRef {
  kind: "pending" | "completed"
  fromTeamName: string
  fromManagerName: string | null
  transferredByName: string | null
  transferredAt: Date | null
  scheduledAtTransfer: boolean
}

export interface BackofficeAllUsersScheduleFiltersInput {
  query?: string
  functions?: BackofficeScheduleFunction[]
  meetingStatuses?: ScheduleMeetingStatus[]
  leadStatuses?: string[]
  dateFrom?: Date
  dateTo?: Date
}

export interface BackofficeAllUsersScheduleRecord {
  id: string
  source: "product" | "backoffice"
  role: "sdr" | "closer"
  date: Date
  meetingTitle: string | null
  meetingLink: string | null
  notes: string | null
  isCanceled: boolean
  meetingStatus: ScheduleMeetingStatus
  createdAt: Date
  sdr: BackofficeAllUsersScheduleMemberRef | null
  closer: BackofficeAllUsersScheduleMemberRef | null
  transfer: BackofficeAllUsersScheduleTransferRef | null
  lead: {
    id: string
    name: string
    email: string | null
    phone: string | null
    status: string
    meetingHeald: "yes" | "no" | null
  }
}

export interface BackofficeAllUsersScheduleListResult {
  items: BackofficeAllUsersScheduleRecord[]
  totalItems: number
}

export interface BackofficeAllUsersListResult {
  items: BackofficeAllUsersListRecord[]
  totalItems: number
}

export interface IBackofficeAllUsersRepository {
  list(
    filters: BackofficeAllUsersFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ): Promise<BackofficeAllUsersListResult>

  findDetailById(profileId: string): Promise<BackofficeAllUsersDetailRecord | null>

  findSchedulesByProfileId(
    profileId: string,
    filters: BackofficeAllUsersScheduleFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ): Promise<BackofficeAllUsersScheduleListResult>

  findIsMaster(profileId: string): Promise<boolean | null>

  upsertUserTypeAssignment(
    profileId: string,
    data: BackofficeUpsertUserTypeAssignmentInput
  ): Promise<BackofficeAllUsersUserTypeRef>
}
