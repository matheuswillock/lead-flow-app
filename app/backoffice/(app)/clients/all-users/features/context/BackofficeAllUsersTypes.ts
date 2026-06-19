import type { ScheduleMeetingStatus } from "@/lib/lead-meeting"

export type BackofficeAllUsersRole = "manager" | "operator" | "backoffice"
export type BackofficeAllUsersRoleFilter = "master" | "manager" | "operator"
export type BackofficeAllUsersPlanFilter = "lifetime" | "monthly" | "trial" | "none"
export type BackofficeAllUsersUserTypeFilter = "common" | "member_pro"

export interface BackofficeAllUsersUserType {
  slug: "common" | "member_pro"
  label: string
  accessExpiresAt: string | null
  isExpired: boolean
}

export interface BackofficeAllUsersPlan {
  label: string
  amount: number | null
  kind: "lifetime" | "monthly" | "trial" | "none"
}

export interface BackofficeAllUsersMasterRef {
  id: string
  fullName: string | null
  plan: BackofficeAllUsersPlan
}

export interface BackofficeAllUsersFunction {
  name: "SDR" | "CLOSER"
  label: string
}

export interface BackofficeAllUsersItem {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  role: BackofficeAllUsersRole
  functions: BackofficeAllUsersFunction[]
  isMaster: boolean
  googleCalendarConnected: boolean
  createdAt: string
  accessStatus: "pending_first_access" | "active"
  hasCompletedFirstAccess: boolean
  lastSignInAt: string | null
  master: BackofficeAllUsersMasterRef | null
  userType: BackofficeAllUsersUserType
}

export interface BackofficeAllUsersTeamSummary {
  id: string
  name: string
  createdAt: string
  membersCount: number
  masterId: string
  masterFullName: string | null
}

export interface BackofficeAllUsersDetail extends BackofficeAllUsersItem {
  googleEmail: string | null
  teams: BackofficeAllUsersTeamSummary[]
}

export interface BackofficeAllUsersScheduleTarget {
  id: string
  fullName: string | null
  email: string
}

export type BackofficeScheduleFunction = "sdr" | "closer"

export type BackofficeAllUsersScheduleRoleFilter = "all" | BackofficeScheduleFunction

export type BackofficeAllUsersScheduleMeetingStatusFilter =
  | "all"
  | ScheduleMeetingStatus

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
  transferredAt: string | null
  scheduledAtTransfer: boolean
}

export interface BackofficeAllUsersScheduleItem {
  id: string
  source: "product" | "backoffice"
  role: "sdr" | "closer"
  date: string
  meetingTitle: string | null
  meetingLink: string | null
  notes: string | null
  isCanceled: boolean
  meetingStatus: ScheduleMeetingStatus
  meetingStatusLabel: string
  createdAt: string
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

export interface BackofficeAllUsersScheduleFilters {
  query: string
  functions: BackofficeScheduleFunction[]
  meetingStatuses: ScheduleMeetingStatus[]
  leadStatuses: string[]
  dateFrom: string | null
  dateTo: string | null
}

export const DEFAULT_BACKOFFICE_SCHEDULE_FILTERS: BackofficeAllUsersScheduleFilters = {
  query: "",
  functions: [],
  meetingStatuses: [],
  leadStatuses: [],
  dateFrom: null,
  dateTo: null,
}

export interface BackofficeAllUsersScheduleListResult {
  items: BackofficeAllUsersScheduleItem[]
  pagination: BackofficePagination
}

export interface BackofficeAllUsersFilters {
  query: string
  role: BackofficeAllUsersRoleFilter | "all"
  plan: BackofficeAllUsersPlanFilter | "all"
  userType: BackofficeAllUsersUserTypeFilter | "all"
}

export interface BackofficePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BackofficeAllUsersListResult {
  items: BackofficeAllUsersItem[]
  pagination: BackofficePagination
}
