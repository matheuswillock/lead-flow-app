import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"
import { resolveBillingGraceUntil as resolveDueDateGraceUntil } from "@/app/api/shared/billing/billingGraceWindow"
import { isDueDateBeforeTodayInSaoPaulo } from "@/lib/billing/due-date"
import type { IAccountAccessDecisionService } from "./IAccountAccessDecisionService"

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trial"])
const RESTRICTED_SUBSCRIPTION_STATUSES = new Set(["past_due", "suspended", "canceled"])

function resolveBillingGraceUntil(account: AccountAccessRecord): Date | null {
  // A data de uma concessão só vale com a concessão marcada como ativa; uma data
  // residual sem `temporaryAccessGranted` nunca pode liberar acesso.
  if (account.temporaryAccessGranted === true && account.temporaryAccessUntil) {
    return account.temporaryAccessUntil
  }
  return resolveDueDateGraceUntil({
    subscriptionStatus: account.subscriptionStatus,
    subscriptionNextDueDate: account.subscriptionNextDueDate ?? null,
  })
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
        // Carência de cobrança (não uma concessão operacional): a tela avisa o vencimento.
        const isBillingGrace = account.temporaryAccessGranted !== true && account.subscriptionStatus === "past_due"
        return {
          state: "allowed",
          temporaryAccessGranted: true,
          temporaryAccessUntil,
          ...(isBillingGrace ? { billingGraceUntil: temporaryAccessUntil } : {}),
        }
      }
      // Somente past_due degrada para leitura; uma concessão expirada não transforma
      // suspended/canceled em read_only: elas seguem para as regras restritivas abaixo.
      // Sem corte fixo de dias: a leitura dura enquanto a conta continuar past_due;
      // a transição para suspended/canceled é decidida pelo motor de assinatura.
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
