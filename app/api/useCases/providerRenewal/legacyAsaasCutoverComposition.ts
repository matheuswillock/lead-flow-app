import { providerRenewalRepository } from "@/app/api/infra/data/repositories/providerRenewal/ProviderRenewalRepository";
import { asaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import { isProviderRenewalEnabled } from "@/lib/payment-provider/renewal-kill-switch";
import { LegacyAsaasRenewalCutover } from "./LegacyAsaasRenewalCutover";

/** Corte legado real: único ponto que cancela assinatura do Asaas na renovação pelo roteador. */
export function createLegacyAsaasRenewalCutover(): LegacyAsaasRenewalCutover {
  return new LegacyAsaasRenewalCutover({
    isEnabled: () => isProviderRenewalEnabled(),
    findLegacySubscription: (profileId) => providerRenewalRepository.findLegacyAsaasSubscription(profileId),
    cancelAsaasSubscription: (subscriptionId, account) => asaasSubscriptionService.cancelSubscription(subscriptionId, account),
    markOnRouter: (profileId, provider) => providerRenewalRepository.markOnRouter(profileId, provider),
  });
}
