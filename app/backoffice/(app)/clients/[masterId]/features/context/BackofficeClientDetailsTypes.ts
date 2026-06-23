export interface BackofficeClientTeamMember {
  id: string
  teamMemberId: string
  fullName: string | null
  email: string
  phone: string | null
  addedAt: string
  role: string
  googleCalendarConnected: boolean
  googleEmail: string | null
  functions: string[]
  isMaster: boolean
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  accessStatus: "pending_first_access" | "active"
  hasCompletedFirstAccess: boolean
  lastSignInAt: string | null
}

export interface BackofficeClientTeam {
  id: string
  name: string
  createdAt: string
  membersCount: number
  members: BackofficeClientTeamMember[]
  transferRoutes: Array<{ teamId: string; teamName: string }>
}

export interface BackofficeClientDetails {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  cpfCnpj: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  city: string | null
  state: string | null
  functions: string[]
  profileIconUrl: string | null
  createdAt: string
  linkedUsersCount: number
  plan: {
    label: string
    amount: number | null
    kind: "lifetime" | "monthly" | "trial" | "none"
  }
  subscription: {
    hasAccess: boolean
    status: string | null
  }
  teams: BackofficeClientTeam[]
  allTeams: Array<{ id: string; name: string }>
  teamsPagination: BackofficePagination
}

export interface BackofficeClientInvoice {
  id: string
  status: string
  statusGroup: "paid" | "overdue" | "upcoming" | "other"
  value: number
  dateCreated: string | null
  dueDate: string | null
  paymentDate: string | null
  description: string
  billingType: string
  invoiceUrl: string | null
  bankSlipUrl: string | null
  invoiceNumber: string | null
}

export interface BackofficeClientInvoicesResult {
  items: BackofficeClientInvoice[]
  pagination: BackofficePagination
  summary: {
    charged: number
    upcoming: number
    overdue: number
  }
  filters: BackofficeClientInvoiceFilters
}

export interface BackofficeClientInvoiceFilters {
  status: "all" | "paid" | "overdue" | "upcoming"
  period: "all" | "7d" | "30d" | "90d" | "this_month"
}

export interface BackofficeClientDetailsFilters {
  query: string
}

export interface BackofficePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}
