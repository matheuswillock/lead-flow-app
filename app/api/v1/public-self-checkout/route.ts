import { selfCheckoutUseCase } from "@/app/api/useCases/selfCheckout/selfCheckoutComposition"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { createSelfCheckoutPostHandler } from "./handlers"

/**
 * Auto-checkout público: cria a adesão do CRM padrão e devolve o token da `/adesao`.
 * O preço nunca vem do corpo; as guardas vivem em `handlers.ts`.
 */
export const POST = createSelfCheckoutPostHandler({
  useCase: selfCheckoutUseCase,
  consumeRateLimit: consumeBillingRateLimit,
})
