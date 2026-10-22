import type { CredentialResolverDeps, ResolverInstance } from "./credential-resolver"
import type { ProviderInstanceRecord } from "./instance"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type CredentialInstanceSource = {
  findPrimary(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
  ): Promise<ProviderInstanceRecord | null>
  findByScope(
    provider: PaymentProviderKey,
    environment: PaymentProviderEnvironment,
    externalAccountContext: string,
  ): Promise<ProviderInstanceRecord | null>
}

function toResolverInstance(record: ProviderInstanceRecord, isPrimary: boolean): ResolverInstance {
  return {
    id: record.id,
    externalAccountContext: record.externalAccountContext,
    settings: record.settings,
    isPrimary,
  }
}

/**
 * Localiza a instância cujas credenciais o resolver deve ler: a do contexto pedido ou, sem
 * contexto, a principal. Marca se ela é a principal (só ela pode usar a reserva de ambiente).
 */
export function createCredentialInstanceLookup(
  source: CredentialInstanceSource,
): CredentialResolverDeps["findInstance"] {
  return async (selector) => {
    const primary = await source.findPrimary(selector.provider, selector.environment)
    if (!selector.externalAccountContext) return primary ? toResolverInstance(primary, true) : null
    const scoped = await source.findByScope(
      selector.provider,
      selector.environment,
      selector.externalAccountContext,
    )
    return scoped ? toResolverInstance(scoped, scoped.id === primary?.id) : null
  }
}
