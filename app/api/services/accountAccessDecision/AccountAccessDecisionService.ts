import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"
import type { IAccountAccessDecisionService } from "./IAccountAccessDecisionService"

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trial"])
const RESTRICTED_SUBSCRIPTION_STATUSES = new Set(["past_due", "suspended", "canceled"])
const BILLING_GRACE_DAYS = 5
const DAY_MS = 24 * 60 * 60 * 1000

function isDueDateBeforeTodayInSaoPaulo(dueDate: Date, now: Date): boolean {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  return dueDate.toISOString().slice(0, 10) < today
}

function resolveBillingGraceUntil(account: AccountAccessRecord): Date | null {
  // A data de uma concessão só vale com a concessão marcada como ativa; uma data
  // residual sem `temporaryAccessGranted` nunca pode liberar acesso.
  if (account.temporaryAccessGranted === true && account.temporaryAccessUntil) {
    return account.temporaryAccessUntil
  }
  if (account.subscriptionStatus !== "past_due" || !account.subscriptionNextDueDate) {
    return null
  }
  return new Date(account.subscriptionNextDueDate.getTime() + BILLING_GRACE_DAYS * DAY_MS)
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

    if (account.temporaryAccessGranted && account.temporaryAccessUntil === null) {
      return { state: "allowed", temporaryAccessGranted: true, temporaryAccessUntil: null }
    }

    const billingGraceUntil = resolveBillingGraceUntil(account)
    if (billingGraceUntil) {
      const temporaryAccessUntil = billingGraceUntil.toISOString()
      if (billingGraceUntil.getTime() > now.getTime()) {
        return { state: "allowed", temporaryAccessGranted: true, temporaryAccessUntil }
      }
      // Somente past_due degrada para leitura; uma concessão expirada não transforma
      // suspended/canceled em read_only: elas seguem para as regras restritivas abaixo.
      if (account.subscriptionStatus === "past_due") {
        return { state: "read_only", reason: "past_due", temporaryAccessUntil }
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
