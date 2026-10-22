import { backofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository"
import { billingGracePaymentRepository } from "@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository"
import {
  createOwnerChargeMirror,
  createPaymentChargeSettlement,
} from "../paymentCharge/paymentChargeComposition"
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
    paymentCharges: createPaymentChargeSettlement(),
    ledgerMirror: createOwnerChargeMirror(),
    adhesions: {
      async markPaidFromProvider(adhesionId, input) {
        const { backofficeAdhesionService } = await import("../backofficeAdhesion/BackofficeAdhesionService")
        await backofficeAdhesionService.markPaidFromProvider(adhesionId, input)
      },
    },
  })
}
