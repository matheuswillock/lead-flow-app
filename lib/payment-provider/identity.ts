import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type PaymentProviderRoute = "NEW_ROUTER" | "LEGACY_ASAAS"
export type PaymentProviderIdentityType =
  | "CUSTOMER"
  | "PAYMENT"
  | "SUBSCRIPTION"
  | "CHECKOUT"
  | "SESSION"

export type ProviderIdentityBinding = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly externalId: string
  readonly identityType: PaymentProviderIdentityType
  readonly ownerType: string
  readonly ownerId: string
  readonly tenantId: string
  readonly route: PaymentProviderRoute
  readonly routeVersion: string
}

export function createProviderIdentityKey(binding: ProviderIdentityBinding): string {
  assertRequired("external account context", binding.externalAccountContext, "contexto da conta")
  assertRequired("external id", binding.externalId, "id externo")
  assertRequired("owner type", binding.ownerType, "tipo do owner")
  assertRequired("owner id", binding.ownerId, "id do owner")
  assertRequired("tenant id", binding.tenantId, "id do tenant")
  return [
    binding.provider,
    binding.environment,
    binding.externalAccountContext,
    binding.externalId,
    binding.identityType,
  ].join("|")
}

export function assertProviderIdentityBindingImmutable(
  previous: ProviderIdentityBinding,
  next: ProviderIdentityBinding,
): void {
  const immutableFields: Array<keyof ProviderIdentityBinding> = [
    "provider",
    "environment",
    "externalAccountContext",
    "externalId",
    "identityType",
    "ownerType",
    "ownerId",
    "tenantId",
    "route",
  ]
  for (const field of immutableFields) {
    if (previous[field] !== next[field]) {
      throw new Error(`Binding de identidade externa é imutável: ${field}`)
    }
  }
}

function assertRequired(label: string, value: string, messageLabel: string): void {
  if (!value.trim()) throw new Error(`${label} exige ${messageLabel}`)
}
