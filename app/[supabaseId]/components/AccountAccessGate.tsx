"use client"

import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { AccountAccessPausedScreen } from "./AccountAccessPausedScreen"

type AccountAccessGateProps = {
  decision: AccountAccessDecision | null | undefined
  decisionResolved?: boolean
  children: React.ReactNode
}

export function AccountAccessGate({ decision, decisionResolved = false, children }: AccountAccessGateProps) {
  const teamContext = useOptionalTeamContext()
  const effectiveDecision = teamContext ? teamContext.accountAccessDecision : decision

  if (!effectiveDecision && decisionResolved) {
    return (
      <AccountAccessPausedScreen
        reason="subscription_unavailable"
        isBillingOwner={teamContext?.isTeamMaster ?? false}
      />
    )
  }

  if (effectiveDecision?.state === "restricted" && !teamContext?.isSwitchingTeam) {
    return (
      <AccountAccessPausedScreen
        isBillingOwner={teamContext?.isTeamMaster ?? effectiveDecision.isBillingOwner}
        reason={effectiveDecision.reason}
      />
    )
  }

  return children
}
