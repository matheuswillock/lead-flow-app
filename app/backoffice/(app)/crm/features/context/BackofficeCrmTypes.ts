export type BackofficeLeadStatusKey =
  | "new_opportunity"
  | "scheduled"
  | "no_show"
  | "new_adhesion"
  | "lost"
  | "implementation"
  | "finalized"

export type BackofficeAdhesionStatusKey =
  | "pending"
  | "paid"
  | "overdue"
  | "expired"
  | "canceled"

export type BackofficeLeadOriginKey = "manual" | "webhook_meta"

export interface BackofficeCrmUserOption {
  id: string
  name: string
  email: string
  isActive: boolean
  isSdr: boolean
  isCloser: boolean
  googleCalendarConnected: boolean
  googleEmail: string | null
  timezone: string
}

export interface BackofficeLeadCompactUser {
  id: string
  name: string
  email: string
}

export interface BackofficeLeadItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  notes: string | null
  status: BackofficeLeadStatusKey
  origin: BackofficeLeadOriginKey
  sourceExternalId: string | null
  sourceWebhookEventId: string | null
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
  sdr: BackofficeLeadCompactUser | null
  closer: BackofficeLeadCompactUser | null
  meetingDate: string | null
  meetingTitle: string | null
  meetingNotes: string | null
  meetingLink: string | null
  meetingExtraGuests: string[]
  adhesion: {
    id: string
    status: BackofficeAdhesionStatusKey
    expiresAt: string
    paidAt: string | null
  } | null
  statusEnteredAt: string
  createdAt: string
  updatedAt: string
  qualificationLeadOrganization: string | null
  qualificationAvgUsers: string | null
  qualificationProfileFit: string | null
}

export interface BackofficeLeadCreateInput {
  name: string
  email?: string | null
  phone?: string | null
  cpfCnpj?: string | null
  notes?: string | null
  status?: BackofficeLeadStatusKey
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingExtraGuests?: string[] | null
  qualificationLeadOrganization?: string | null
  qualificationAvgUsers?: string | null
  qualificationProfileFit?: string | null
}

export interface BackofficeLeadUpdateInput {
  name?: string
  email?: string | null
  phone?: string | null
  cpfCnpj?: string | null
  notes?: string | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  meetingDate?: string | null
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingExtraGuests?: string[] | null
  qualificationLeadOrganization?: string | null
  qualificationAvgUsers?: string | null
  qualificationProfileFit?: string | null
}

export interface BackofficeLeadScheduleInput {
  closerBackofficeUserId: string
  meetingDate: string
  meetingTitle?: string | null
  meetingNotes?: string | null
  meetingLink?: string | null
  extraGuests?: string[]
}

export interface BackofficeCrmFiltersState {
  query: string
  statusFilter: BackofficeLeadStatusKey[]
  sdrFilter: string[]
  closerFilter: string[]
  periodStart: string
  periodEnd: string
}

export type BackofficeCrmTableColumnKey =
  | "name"
  | "email"
  | "phone"
  | "cpfCnpj"
  | "status"
  | "origin"
  | "sdr"
  | "closer"
  | "meetingDate"
  | "notes"
  | "createdAt"
  | "updatedAt"

export type BackofficeCrmTableColumnVisibility = Record<
  BackofficeCrmTableColumnKey,
  boolean
>

export const BACKOFFICE_CRM_COLUMNS: { key: BackofficeLeadStatusKey; title: string }[] = [
  { key: "new_opportunity", title: "Nova oportunidade" },
  { key: "scheduled", title: "Agendado" },
  { key: "no_show", title: "No-show" },
  { key: "new_adhesion", title: "Nova adesão" },
  { key: "lost", title: "Perdido" },
  { key: "implementation", title: "Implementação" },
  { key: "finalized", title: "Finalizado" },
]

export const BACKOFFICE_CRM_STATUS_LABELS: Record<BackofficeLeadStatusKey, string> =
  BACKOFFICE_CRM_COLUMNS.reduce(
    (acc, status) => {
      acc[status.key] = status.title
      return acc
    },
    {} as Record<BackofficeLeadStatusKey, string>
  )

export const DEFAULT_BACKOFFICE_CRM_FILTERS: BackofficeCrmFiltersState = {
  query: "",
  statusFilter: [],
  sdrFilter: [],
  closerFilter: [],
  periodStart: "",
  periodEnd: "",
}

export const DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY: BackofficeCrmTableColumnVisibility =
  {
    name: true,
    email: true,
    phone: true,
    cpfCnpj: true,
    status: true,
    origin: true,
    sdr: true,
    closer: true,
    meetingDate: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
  }

export const DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER = [
  "drag",
  "name",
  "email",
  "phone",
  "cpfCnpj",
  "status",
  "origin",
  "sdr",
  "closer",
  "meetingDate",
  "notes",
  "createdAt",
  "updatedAt",
  "actions",
]

export function isBackofficeLeadStatusKey(
  value: unknown
): value is BackofficeLeadStatusKey {
  return (
    typeof value === "string" &&
    BACKOFFICE_CRM_COLUMNS.some((status) => status.key === value)
  )
}

export function normalizeBackofficeCrmFilters(
  raw: unknown
): BackofficeCrmFiltersState {
  if (!raw || typeof raw !== "object") return DEFAULT_BACKOFFICE_CRM_FILTERS

  const data = raw as Partial<BackofficeCrmFiltersState>
  return {
    query: typeof data.query === "string" ? data.query : "",
    statusFilter: Array.isArray(data.statusFilter)
      ? data.statusFilter.filter(isBackofficeLeadStatusKey)
      : [],
    sdrFilter: Array.isArray(data.sdrFilter)
      ? data.sdrFilter.filter((value): value is string => typeof value === "string")
      : [],
    closerFilter: Array.isArray(data.closerFilter)
      ? data.closerFilter.filter((value): value is string => typeof value === "string")
      : [],
    periodStart: typeof data.periodStart === "string" ? data.periodStart : "",
    periodEnd: typeof data.periodEnd === "string" ? data.periodEnd : "",
  }
}

export function isBackofficeCrmFiltersEmpty(
  filters: BackofficeCrmFiltersState
): boolean {
  return (
    !filters.query.trim() &&
    filters.statusFilter.length === 0 &&
    filters.sdrFilter.length === 0 &&
    filters.closerFilter.length === 0 &&
    !filters.periodStart &&
    !filters.periodEnd
  )
}
