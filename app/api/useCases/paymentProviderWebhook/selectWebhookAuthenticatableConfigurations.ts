import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"

/**
 * Uma instância desabilitada, com kill switch ligado ou rollout DISABLED não pode autenticar
 * webhook: suas credenciais continuam válidas no provider mesmo depois de desligada no
 * backoffice, e um evento batendo só nela indicaria um segredo vazado/reaproveitado, não tráfego
 * legítimo de uma instância ativa.
 */
export function selectWebhookAuthenticatableConfigurations(
  configurations: readonly ProviderRoutingConfigRecord[],
): readonly ProviderRoutingConfigRecord[] {
  return configurations.filter(
    (item) => item.enabled && !item.killSwitch && item.rolloutState !== "DISABLED",
  )
}
