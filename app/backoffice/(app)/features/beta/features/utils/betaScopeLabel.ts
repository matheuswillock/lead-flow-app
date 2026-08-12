import type { BetaGrantItem } from "../context/BackofficeBetaTypes"

export function scopeLabel(grant: Pick<BetaGrantItem, "betaTeamScope" | "teams">): string {
  if (grant.betaTeamScope === "ALL_TEAMS") {
    return "Todos os times"
  }

  if (grant.teams.length === 0) {
    return "Times específicos (nenhum selecionado)"
  }

  if (grant.teams.length <= 2) {
    return grant.teams.map((team) => team.name).join(", ")
  }

  return `${grant.teams.length} times: ${grant.teams
    .slice(0, 2)
    .map((team) => team.name)
    .join(", ")}…`
}

export function betaBillingLabel(chargeDuringBeta: boolean): string {
  return chargeDuringBeta ? "Beta cobrado" : "Beta gratuito"
}
