import { backofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import {
  PaymentOwnerSettlementService,
  type PaymentOwnerSettlement,
} from "./PaymentOwnerSettlementService"

/**
 * A adesão é carregada sob demanda (import dinâmico): o serviço de adesão puxa Supabase Admin,
 * e-mail e Asaas, que o webhook e o cron não precisam enquanto não houver pagamento a aplicar.
 */
export function createPaymentOwnerSettlement(): PaymentOwnerSettlement {
  return new PaymentOwnerSettlementService({
    adhesionPayments: backofficeAdhesionPaymentRepository,
    gracePayments: billingGracePaymentRepository,
    adhesions: {
      async markPaidFromProvider(adhesionId, input) {
        const { backofficeAdhesionService } = await import("../backofficeAdhesion/BackofficeAdhesionService")
        await backofficeAdhesionService.markPaidFromProvider(adhesionId, input)
      },
    },
    pendingActions: {
      async expectedAmountInCents(pendingActionId) {
        const { pendingActionRepository } = await import(
          "@/app/api/infra/data/repositories/pendingAction/PendingActionRepository"
        )
        const action = await pendingActionRepository.findApplicableById(pendingActionId)
        if (!action) return null
        const totalCharge = Number((action.payload as { totalCharge?: unknown } | null)?.totalCharge ?? 0)
        return Math.round(totalCharge * 100)
      },
      async applyById(pendingActionId) {
        const { pendingActionUseCase } = await import("@/app/api/useCases/pendingActions/PendingActionUseCase")
        return pendingActionUseCase.applyPendingActionById(pendingActionId)
      },
    },
  })
}
