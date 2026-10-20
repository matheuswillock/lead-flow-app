import { PaymentProviderError } from "./errors"
import type { PaymentProviderEnvironment } from "./types"

export type PaymentProviderConfigInput = {
  readonly apiKey: string
  readonly publicKey: string
  readonly webhookSecret: string
  readonly webhookSigningKey: string
  readonly environment: PaymentProviderEnvironment
  readonly devMode: boolean
  readonly baseUrl?: string
}

export class PaymentProviderConfig {
  readonly apiKey: string
  readonly publicKey: string
  readonly webhookSecret: string
  readonly webhookSigningKey: string
  readonly environment: PaymentProviderEnvironment
  readonly devMode: boolean
  readonly baseUrl: string

  private constructor(input: PaymentProviderConfigInput) {
    this.apiKey = input.apiKey
    this.publicKey = input.publicKey
    this.webhookSecret = input.webhookSecret
    this.webhookSigningKey = input.webhookSigningKey
    this.environment = input.environment
    this.devMode = input.devMode
    this.baseUrl = (input.baseUrl ?? "https://api.abacatepay.com").replace(/\/$/, "")
    Object.freeze(this)
  }

  static create(input: PaymentProviderConfigInput): PaymentProviderConfig {
    const required = [input.apiKey, input.publicKey, input.webhookSecret, input.webhookSigningKey]
    if (required.some((value) => typeof value !== "string" || value.trim() === "")) {
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
    return `${this.environment}:${this.devMode ? "dev" : "production"}:${this.publicKey.slice(0, 8)}`
  }
}
