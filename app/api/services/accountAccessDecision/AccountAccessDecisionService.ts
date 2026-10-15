import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"
import type { IAccountAccessDecisionService } from "./IAccountAccessDecisionService"

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trial"])
const RESTRICTED_SUBSCRIPTION_STATUSES = new Set(["past_due", "suspended", "canceled"])

function isDueDateBeforeTodayInSaoPaulo(dueDate: Date, now: Date): boolean {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  return dueDate.toISOString().slice(0, 10) < today
}

export class AccountAccessDecisionService implements IAccountAccessDecisionService {
  decide(account: AccountAccessRecord, now = new Date()): AccountAccessDecision {
    if (account.isBanned) {
      return { state: "restricted", reason: "banned" }
    }

    if (account.hasPermanentSubscription) {
      return { state: "allowed" }
    }

    if (account.annualSubscriptionActive) {
      return { state: "allowed" }
    }

    if (account.memberProActive) {
      return { state: "allowed" }
    }

    if (
      account.temporaryAccessGranted &&
      (!account.temporaryAccessUntil || account.temporaryAccessUntil.getTime() > now.getTime())
    ) {
      return {
        state: "allowed",
        temporaryAccessGranted: true,
        temporaryAccessUntil: account.temporaryAccessUntil?.toISOString() ?? null,
      }
    }

    if (account.memberProBlocked) {
      return { state: "restricted", reason: "past_due" }
    }

    if (account.subscriptionNextDueDate && isDueDateBeforeTodayInSaoPaulo(account.subscriptionNextDueDate, now)) {
      return { state: "restricted", reason: "past_due" }
    }

    if (ALLOWED_SUBSCRIPTION_STATUSES.has(account.subscriptionStatus ?? "")) {
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
