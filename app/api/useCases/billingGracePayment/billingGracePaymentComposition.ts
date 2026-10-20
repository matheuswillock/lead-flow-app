import { billingGracePaymentService } from "@/app/api/services/BillingGracePayment/BillingGracePaymentService"
import { BillingGracePaymentUseCase } from "./BillingGracePaymentUseCase"

export function getBillingGracePaymentUseCase() {
  return new BillingGracePaymentUseCase(billingGracePaymentService)
}
