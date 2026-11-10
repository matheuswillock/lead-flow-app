import { selfCheckoutUseCase } from "@/app/api/useCases/selfCheckout/selfCheckoutComposition"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { createSelfCheckoutCouponPostHandler } from "../handlers"

/** Simula o desconto de um cupom no auto-checkout público; o valor vem sempre do servidor. */
export const POST = createSelfCheckoutCouponPostHandler({
  useCase: selfCheckoutUseCase,
  consumeRateLimit: consumeBillingRateLimit,
})
