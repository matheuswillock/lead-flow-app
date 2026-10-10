import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"
import { AccountAccessPausedScreen } from "./AccountAccessPausedScreen"

type AccountAccessGateProps = {
  decision: AccountAccessDecision | null | undefined
  children: React.ReactNode
}

export function AccountAccessGate({ decision, children }: AccountAccessGateProps) {
  if (decision?.state !== "allowed") {
    return <AccountAccessPausedScreen />
  }

  return children
}
