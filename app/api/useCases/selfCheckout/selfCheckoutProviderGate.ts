import { SelfCheckoutError } from "@/lib/self-checkout/contracts"
import type { ISelfCheckoutProviderGate } from "./ISelfCheckoutUseCase"

export const PROVIDER_UNAVAILABLE_MESSAGE =
  "O pagamento está temporariamente indisponível. Tente novamente em instantes."

/**
 * Reutiliza a seleção de provider do PIX da adesão (enabled, rollout ACTIVE, HEALTHY, sem
 * kill switch): qualquer falha ao selecioná-lo, inclusive credencial ausente, fecha o checkout.
 */
export function createSelfCheckoutProviderGate(gateway: {
  select(): Promise<unknown>
}): ISelfCheckoutProviderGate {
  return {
    async assertAvailable() {
      try {
        await gateway.select()
      } catch (error) {
        console.warn(
          "[SelfCheckoutProviderGate] provider indisponível:",
          error instanceof Error ? error.name : "erro desconhecido",
        )
        throw new SelfCheckoutError("PROVIDER_UNAVAILABLE", PROVIDER_UNAVAILABLE_MESSAGE)
      }
    },
  }
}
