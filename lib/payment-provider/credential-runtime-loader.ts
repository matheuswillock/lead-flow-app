import type { InstanceSelector } from "./credential-cache"

export type CredentialRuntime = {
  hydrateProviderCredentials(selector: InstanceSelector): Promise<unknown>
}

type RuntimeLoader = () => Promise<CredentialRuntime>

const defaultLoader: RuntimeLoader = () =>
  import("@/app/api/useCases/paymentProviderPayment/providerCredentialRuntime")

let loader: RuntimeLoader = defaultLoader

/**
 * Carrega sob demanda o runtime de credenciais (banco + cifra), que não pode ser importado
 * estaticamente por código de `lib/` usado fora do servidor de pagamentos.
 */
export function loadCredentialRuntime(): Promise<CredentialRuntime> {
  return loader()
}

/**
 * Para quem lê o cache de forma síncrona: dispara a hidratação em segundo plano (o que também
 * registra o hook de atualização do cache). Nunca lança nem aguarda.
 */
export function warmCredentialRuntime(selector: InstanceSelector): void {
  void loadCredentialRuntime()
    .then((runtime) => runtime.hydrateProviderCredentials(selector))
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
