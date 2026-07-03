export type MemberRole = "manager" | "backoffice" | "operator"
export type MemberFunction = "SDR" | "CLOSER"

export type TeamAccessFormState = {
  role: MemberRole
  functions: MemberFunction[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
}

export type TeamMembershipDraft = {
  teamId: string
  teamName: string
  membersCount: number
  isMember: boolean
  isPendingAdd: boolean
  isPendingRemove: boolean
  access: TeamAccessFormState
  originalAccess?: TeamAccessFormState
}

export type BackofficeMemberAccountTeamItem = {
  teamId: string
  teamName: string
  membersCount: number
  isMember: boolean
  role?: string
  functions?: string[]
  canCreateAccountUsers?: boolean
  canManageAccountTeams?: boolean
  canTransferAccountLeads?: boolean
  canViewAllTeams?: boolean
}

export const ROLE_OPTIONS: {
  value: MemberRole
  label: string
  description: string
}[] = [
  {
    value: "manager",
    label: "Manager",
    description: "Gerencia usuários e configurações do time.",
  },
  {
    value: "backoffice",
    label: "Backoffice",
    description: "Acesso de gestão equivalente ao Manager (sem privilégios de master).",
  },
  {
    value: "operator",
    label: "Operator",
    description: "Acesso operacional aos leads e atividades do time.",
  },
]

export const FUNCTION_OPTIONS: {
  value: MemberFunction
  label: string
  description: string
}[] = [
  {
    value: "SDR",
    label: "SDR",
    description: "Pode visualizar, editar e agendar os leads.",
  },
  {
    value: "CLOSER",
    label: "Closer",
    description: "Mesmo acesso do SDR nos leads, mas só ele pode fechar contratos.",
  },
]

export function toMemberRole(value: string): MemberRole {
  if (value === "manager" || value === "backoffice" || value === "operator") return value
  return "operator"
}

export function toMemberFunctions(values: string[]): MemberFunction[] {
  return values.filter((value): value is MemberFunction => value === "SDR" || value === "CLOSER")
}

export function defaultOperatorAccess(): TeamAccessFormState {
  return {
    role: "operator",
    functions: [],
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
  }
}

export function accessFromAccountTeamItem(
  item: BackofficeMemberAccountTeamItem
): TeamAccessFormState {
  if (!item.isMember) return defaultOperatorAccess()
  return normalizeAccessForRole({
    role: toMemberRole(item.role ?? "operator"),
    functions: toMemberFunctions(item.functions ?? []),
    canCreateAccountUsers: item.canCreateAccountUsers ?? false,
    canManageAccountTeams: item.canManageAccountTeams ?? false,
    canTransferAccountLeads: item.canTransferAccountLeads ?? false,
    canViewAllTeams: item.canViewAllTeams ?? false,
  })
}

export function normalizeAccessForRole(access: TeamAccessFormState): TeamAccessFormState {
  const isManager = access.role === "manager"
  const isManagerLike = access.role === "manager" || access.role === "backoffice"

  return {
    role: access.role,
    functions: access.functions,
    canCreateAccountUsers: isManager && access.canCreateAccountUsers,
    canManageAccountTeams: isManager && access.canManageAccountTeams,
    canTransferAccountLeads: isManagerLike && access.canTransferAccountLeads,
    canViewAllTeams: isManagerLike && access.canViewAllTeams,
  }
}

export function buildTeamsDraft(
  items: BackofficeMemberAccountTeamItem[]
): Record<string, TeamMembershipDraft> {
  const draft: Record<string, TeamMembershipDraft> = {}

  for (const item of items) {
    const access = accessFromAccountTeamItem(item)
    draft[item.teamId] = {
      teamId: item.teamId,
      teamName: item.teamName,
      membersCount: item.membersCount,
      isMember: item.isMember,
      isPendingAdd: false,
      isPendingRemove: false,
      access,
      originalAccess: item.isMember ? { ...access, functions: [...access.functions] } : undefined,
    }
  }

  return draft
}

export function accessChanged(
  current: TeamAccessFormState,
  original: TeamAccessFormState | undefined
): boolean {
  if (!original) return true
  const normalizedCurrent = normalizeAccessForRole(current)
  const normalizedOriginal = normalizeAccessForRole(original)

  return (
    normalizedCurrent.role !== normalizedOriginal.role ||
    JSON.stringify([...normalizedCurrent.functions].sort()) !==
      JSON.stringify([...normalizedOriginal.functions].sort()) ||
    normalizedCurrent.canCreateAccountUsers !== normalizedOriginal.canCreateAccountUsers ||
    normalizedCurrent.canManageAccountTeams !== normalizedOriginal.canManageAccountTeams ||
    normalizedCurrent.canTransferAccountLeads !== normalizedOriginal.canTransferAccountLeads ||
    normalizedCurrent.canViewAllTeams !== normalizedOriginal.canViewAllTeams
  )
}

export function buildAccessUpdatePayload(
  teamId: string,
  access: TeamAccessFormState
): {
  teamId: string
  role: MemberRole
  functions: MemberFunction[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
} {
  const normalized = normalizeAccessForRole(access)
  return {
    teamId,
    role: normalized.role,
    functions: normalized.functions,
    canCreateAccountUsers: normalized.canCreateAccountUsers,
    canManageAccountTeams: normalized.canManageAccountTeams,
    canTransferAccountLeads: normalized.canTransferAccountLeads,
    canViewAllTeams: normalized.canViewAllTeams,
  }
}
