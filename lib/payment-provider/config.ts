import { PaymentProviderError } from "./errors"
import type { PaymentProviderEnvironment } from "./types"

export type PaymentProviderConfigInput = {
  readonly apiKey: string
  /** Opcional apenas em PRODUCTION enquanto a loja não tem "Checkout próprio" (cartão) liberado. */
  readonly publicKey?: string | null
  readonly webhookSecret: string
  /** Chave do HMAC do webhook; o Abacate Pay usa a chave pública da loja. */
  readonly webhookSigningKey?: string | null
  readonly environment: PaymentProviderEnvironment
  readonly devMode: boolean
  readonly baseUrl?: string
  /** Segredo anterior aceito durante a rotação do segredo da query (janela atual + anterior). */
  readonly webhookSecretPrevious?: string | null
  /** Exige HMAC válido em todo evento, mesmo com o segredo da query correto. */
  readonly requireSignature?: boolean
}

export class PaymentProviderConfig {
  readonly apiKey: string
  readonly publicKey: string | null
  readonly webhookSecret: string
  readonly webhookSigningKey: string | null
  readonly environment: PaymentProviderEnvironment
  readonly devMode: boolean
  readonly baseUrl: string
  readonly webhookSecretPrevious: string | null
  readonly requireSignature: boolean

  private constructor(input: PaymentProviderConfigInput) {
    this.apiKey = input.apiKey
    this.publicKey = input.publicKey ?? null
    this.webhookSecret = input.webhookSecret
    this.webhookSigningKey = input.webhookSigningKey ?? null
    this.environment = input.environment
    this.devMode = input.devMode
    this.baseUrl = (input.baseUrl ?? "https://api.abacatepay.com").replace(/\/$/, "")
    this.webhookSecretPrevious = input.webhookSecretPrevious ?? null
    this.requireSignature = input.requireSignature ?? false
    Object.freeze(this)
  }

  static create(input: PaymentProviderConfigInput): PaymentProviderConfig {
    const isBlank = (value: unknown) => typeof value !== "string" || value.trim() === ""
    const requiresPublicKey = input.environment !== "PRODUCTION"
    const required = [input.apiKey, input.webhookSecret]
    if (requiresPublicKey) required.push(input.publicKey as string, input.webhookSigningKey as string)
    if (required.some(isBlank)) {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "Configuração do provedor incompleta")
    }
    // Chave informada, mas vazia, é configuração quebrada: não pode virar "sem HMAC" em silêncio.
    const optional = [input.publicKey, input.webhookSigningKey, input.webhookSecretPrevious]
    if (optional.some((value) => value != null && isBlank(value))) {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "Configuração do provedor incompleta")
    }
    if (
      (input.environment !== "DEV" && input.environment !== "PRODUCTION") ||
      typeof input.devMode !== "boolean"
    ) {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "Configuração de ambiente inválida")
    }
    if (input.environment === "PRODUCTION" && input.devMode) {
      throw new PaymentProviderError(
        "CONFIGURATION_INVALID",
        "DEV Mode não pode ser usado em produção",
      )
    }
    if (input.environment === "DEV" && !input.devMode) {
      throw new PaymentProviderError(
        "CONFIGURATION_INVALID",
        "DEV Mode é obrigatório no ambiente DEV",
      )
    }
    const baseUrl = input.baseUrl ?? "https://api.abacatepay.com"
    let parsedBaseUrl: URL
    try {
      parsedBaseUrl = new URL(baseUrl)
    } catch {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "base URL do provedor inválida")
    }
    if (
      parsedBaseUrl.protocol !== "https:" ||
      parsedBaseUrl.hostname !== "api.abacatepay.com" ||
      parsedBaseUrl.port !== "" ||
      parsedBaseUrl.username !== "" ||
      parsedBaseUrl.password !== "" ||
      parsedBaseUrl.pathname !== "/" ||
      parsedBaseUrl.search !== "" ||
      parsedBaseUrl.hash !== ""
    ) {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "base URL do provedor inválida")
    }
    return new PaymentProviderConfig(input)
  }

  fingerprint(): string {
    return `${this.environment}:${this.devMode ? "dev" : "production"}:${this.publicKey?.slice(0, 8) ?? "no-public-key"}`
  }
}
