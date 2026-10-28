import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { rejectUnavailableBillingType } from "@/lib/payment-methods/route-guard"
import { createPublicAdhesionCheckoutHandler } from "./checkoutHandler"

/**
 * Checkout legado da adesão (Asaas). Cartão respeita o toggle da plataforma e o PIX de adesão
 * que segue o Abacate é recusado aqui; as guardas vivem em `checkoutHandler.ts`.
 */
export const POST = createPublicAdhesionCheckoutHandler({
  useCase: backofficeAdhesionUseCase,
  consumeRateLimit: consumeBillingRateLimit,
  rejectUnavailableBillingType,
})
