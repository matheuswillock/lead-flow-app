import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"
import type { IAccountAccessDecisionService } from "./IAccountAccessDecisionService"

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trial"])
const RESTRICTED_SUBSCRIPTION_STATUSES = new Set(["past_due", "suspended", "canceled"])

export class AccountAccessDecisionService implements IAccountAccessDecisionService {
  decide(account: AccountAccessRecord): AccountAccessDecision {
    if (account.isBanned) {
      return { state: "restricted", reason: "banned" }
    }

    if (account.hasPermanentSubscription || ALLOWED_SUBSCRIPTION_STATUSES.has(account.subscriptionStatus ?? "")) {
      return { state: "allowed" }
    }

    if (RESTRICTED_SUBSCRIPTION_STATUSES.has(account.subscriptionStatus ?? "")) {
      return {
        state: "restricted",
        reason: account.subscriptionStatus as "past_due" | "suspended" | "canceled",
      }
    }

    return { state: "restricted", reason: "subscription_unavailable" }
  }
}
