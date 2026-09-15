import type { UserRole } from "@prisma/client"
import { isManagerLikeRole } from "@/lib/roles"

/** Papel que o perfil exerce num time específico. */
export type TeamMembershipRole = {
  teamId: string
  role: UserRole
}

/**
 * Visibilidade de agendamentos particionada POR TIME.
 *
 * A restrição de papel não pode ser global: o mesmo perfil pode ser manager no
 * time A (enxerga o agendamento de qualquer membro) e operator no time B
 * (enxerga só os próprios). Aplicar o papel do time ativo a todos os times —
 * como faz `resolveDashboardTeamScope` — mostra demais num time e de menos no
 * outro. Ver o bug do Calendário multi-time de 15/09/2026.
 */
export type TeamScopeVisibility = {
  /** Times em que o perfil é manager-like: enxerga o agendamento de qualquer membro. */
  fullVisibilityTeamIds: string[]
  /** Times em que o perfil tem papel menor: enxerga só os agendamentos que são dele. */
  ownOnlyTeamIds: string[]
  /** Perfil da sessão — dono dos agendamentos nos times de `ownOnlyTeamIds`. */
  ownerProfileId: string
}

export function buildTeamScopeVisibility(input: {
  ownerProfileId: string
  memberships: TeamMembershipRole[]
}): TeamScopeVisibility {
  const fullVisibilityTeamIds: string[] = []
  const ownOnlyTeamIds: string[] = []

  for (const membership of input.memberships) {
    if (isManagerLikeRole(membership.role)) {
      fullVisibilityTeamIds.push(membership.teamId)
    } else {
      ownOnlyTeamIds.push(membership.teamId)
    }
  }

  return {
    fullVisibilityTeamIds,
    ownOnlyTeamIds,
    ownerProfileId: input.ownerProfileId,
  }
}

export function isTeamScopeVisibilityEmpty(visibility: TeamScopeVisibility): boolean {
  return (
    visibility.fullVisibilityTeamIds.length === 0 && visibility.ownOnlyTeamIds.length === 0
  )
}

export function listTeamScopeTeamIds(visibility: TeamScopeVisibility): string[] {
  return [...visibility.fullVisibilityTeamIds, ...visibility.ownOnlyTeamIds]
}
