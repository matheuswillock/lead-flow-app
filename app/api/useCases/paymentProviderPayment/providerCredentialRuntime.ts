import { paymentProviderConfigRepository } from "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
import { paymentProviderCredentialRepository } from "@/app/api/infra/data/repositories/paymentProviderCredential/PaymentProviderCredentialRepository"
import { credentialCache, type InstanceSelector } from "@/lib/payment-provider/credential-cache"
import { createCredentialCipherFromEnv, type CredentialCipher } from "@/lib/payment-provider/credential-cipher"
import { createCredentialResolver } from "@/lib/payment-provider/credential-resolver"

let cachedCipher: CredentialCipher | null = null

/** A chave-mestra só é exigida quando há credencial gravada para decifrar. */
export function getCredentialCipher(): CredentialCipher {
  cachedCipher ??= createCredentialCipherFromEnv(process.env)
  return cachedCipher
}

export const providerCredentialResolver = createCredentialResolver({
  async findInstance(selector) {
    const instance = selector.externalAccountContext
      ? await paymentProviderConfigRepository.findByScope(
          selector.provider,
          selector.environment,
          selector.externalAccountContext,
        )
      : await paymentProviderConfigRepository.findPrimary(selector.provider, selector.environment)
    return instance
      ? {
          id: instance.id,
          externalAccountContext: instance.externalAccountContext,
          settings: instance.settings,
        }
      : null
  },
  loadStored: (configId) => paymentProviderCredentialRepository.listCiphertexts(configId),
  decrypt: (payload, context) => getCredentialCipher().decrypt(payload, context),
  env: () => process.env,
  cache: credentialCache,
  log: (event, fields) => console.info("[PaymentProviderCredentials]", { event, ...fields }),
})

credentialCache.setRefreshHook((selector) => {
  void providerCredentialResolver.resolve(selector).catch((error: unknown) => {
    console.error("[PaymentProviderCredentials] refresh failed", {
      error: error instanceof Error ? error.name : "unknown",
    })
  })
})

export function hydrateProviderCredentials(selector: InstanceSelector) {
  return providerCredentialResolver.resolve(selector)
}

export function invalidateProviderCredentialCache(): void {
  credentialCache.invalidateAll()
}
