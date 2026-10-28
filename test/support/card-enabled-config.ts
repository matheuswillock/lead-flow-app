import { spyOn } from "bun:test"
import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { clearCardEnabledCache } from "@/lib/payment-methods/availability"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"

/**
 * Fixa a flag de cartão do backoffice sem tocar o banco: troca `list` do repositório real por
 * um stub (sem mock.module) e zera o cache de 30 s. Devolve a função que restaura o original.
 */
export function stubCardEnabledConfig(cardEnabled: boolean): () => void {
  clearCardEnabledCache()
  const spy = spyOn(paymentProviderConfigRepository, "list").mockResolvedValue([
    abacateConfig(cardEnabled),
  ])
  return () => {
    spy.mockRestore()
    clearCardEnabledCache()
  }
}

function abacateConfig(cardEnabled: boolean): ProviderRoutingConfigRecord {
  return {
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    enabled: true,
    isDefault: false,
    externalAccountContext: "abacate-production",
    rolloutState: "ACTIVE",
    killSwitch: false,
    cardEnabled,
    revision: 1,
    healthStatus: "HEALTHY",
  }
}
