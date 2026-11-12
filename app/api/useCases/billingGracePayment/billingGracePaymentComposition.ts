import { backofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/BackofficeAdhesionService"
import { BillingGracePaymentService } from "@/app/api/services/BillingGracePayment/BillingGracePaymentService"
import { BillingGracePaymentUseCase } from "./BillingGracePaymentUseCase"

/** A renovação usa os mesmos prazos e preços do checkout de contratação. */
const billingGracePaymentService = new BillingGracePaymentService(
  async () => (await backofficeAdhesionService.getSelfCheckoutOptions()).cycles,
)

export function getBillingGracePaymentUseCase() {
  return new BillingGracePaymentUseCase(billingGracePaymentService)
}
