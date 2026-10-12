import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { AccountAccessPausedScreen } from "./AccountAccessPausedScreen"

type AccountAccessGateProps = {
  decision: AccountAccessDecision | null | undefined
  children: React.ReactNode
}

export function AccountAccessGate({ decision, children }: AccountAccessGateProps) {
  if (decision?.state === "restricted") {
    return (
      <AccountAccessPausedScreen
        isBillingOwner={decision.isBillingOwner}
        canRecoverCard={decision.canRecoverCard}
        reason={decision.reason}
      />
    )
  }

  return children
}
