import { paymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository"
import { createPaymentOwnerSettlement } from "@/app/api/services/PaymentProviderPayment/paymentOwnerSettlementComposition"
import {
  PendingActionProviderPaymentService,
  type PendingActionProviderPayment,
} from "@/app/api/services/PaymentProviderPayment/PendingActionProviderPaymentService"
import { resolvePaymentQueryProvider } from "./paymentProviderPaymentComposition"

export function createPendingActionProviderPayment(): PendingActionProviderPayment {
  return new PendingActionProviderPaymentService({
    sessions: paymentProviderSessionRepository,
    resolveQueryProvider: resolvePaymentQueryProvider,
    settlement: createPaymentOwnerSettlement(),
    now: () => new Date(),
  })
}
