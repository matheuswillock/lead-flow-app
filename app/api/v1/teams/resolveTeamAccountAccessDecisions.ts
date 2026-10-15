import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"

type DecisionOutput = {
  isValid: boolean
  result: unknown
}

type ResolveDecision = (input: {
  profileId: string
  teamId: string
}) => Promise<DecisionOutput>

const restrictedFallback: AccountAccessDecision = {
  state: "restricted",
  reason: "subscription_unavailable",
}

export async function resolveTeamAccountAccessDecisions(input: {
  profileId: string
  teamIds: Iterable<string>
  resolveDecision: ResolveDecision
}): Promise<Map<string, AccountAccessDecision>> {
  const decisions = new Map<string, AccountAccessDecision>()

  await Promise.all(
    [...new Set(input.teamIds)].map(async (teamId) => {
      let decision = restrictedFallback
      try {
        const output = await input.resolveDecision({ profileId: input.profileId, teamId })
        const rawDecision = output.result as AccountAccessDecision | null
        if (output.isValid && rawDecision?.state) decision = rawDecision
      } catch {
        decision = restrictedFallback
      }
      decisions.set(teamId, decision)
    }),
  )

  return decisions
}
