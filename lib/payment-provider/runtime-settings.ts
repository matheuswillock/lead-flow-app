/**
 * Configurações de execução de uma instância de provider que não são segredo.
 * Contrato compartilhado entre o resolver de credenciais (M11) e o webhook (M7).
 */
export type ProviderRuntimeSettings = {
  /** Quando true, o webhook rejeita evento sem assinatura HMAC válida, mesmo com o segredo da query correto. */
  readonly requireSignature: boolean
}

export const DEFAULT_PROVIDER_RUNTIME_SETTINGS: ProviderRuntimeSettings = Object.freeze({
  requireSignature: false,
})
