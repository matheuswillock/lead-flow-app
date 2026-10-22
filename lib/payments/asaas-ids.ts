/** Mesma regra de IncrementalBillingService: ids sintéticos de adesão não existem no Asaas. */
export function isRealAsaasSubscriptionId(subscriptionId: string | null | undefined): subscriptionId is string {
  if (!subscriptionId) return false
  if (subscriptionId.startsWith("external-adhesion-")) return false
  if (subscriptionId.startsWith("adhesion-")) return false
  return true
}
