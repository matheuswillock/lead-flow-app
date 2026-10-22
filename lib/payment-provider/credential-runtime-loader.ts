import { credentialCache, type InstanceSelector } from "./credential-cache"

type RuntimeLoader = () => Promise<unknown>

const defaultLoader: RuntimeLoader = () =>
  import("@/app/api/useCases/paymentProviderPayment/providerCredentialRuntime")

let loader: RuntimeLoader = defaultLoader

/**
 * Garante que o runtime de credenciais (que registra o hook de atualização do cache) esteja
 * carregado e dispara a hidratação em segundo plano. Para quem lê o cache de forma síncrona.
 */
export function warmCredentialRuntime(selector: InstanceSelector): void {
  void loader()
    .then(() => credentialCache.peekAndRefresh(selector))
    .catch((error: unknown) => {
      console.error("[PaymentProviderCredentials] warm-up failed", {
        error: error instanceof Error ? error.name : "unknown",
      })
    })
}

export function setCredentialRuntimeLoaderForTests(replacement: RuntimeLoader): void {
  loader = replacement
}

export function resetCredentialRuntimeLoader(): void {
  loader = defaultLoader
}
