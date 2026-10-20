import type {
  IndeterminatePaymentResult,
  PaymentCapability,
  PaymentMethod,
  PaymentProviderEnvironment,
  PaymentProviderKey,
  ProviderCardPaymentResult,
  ProviderPixPaymentResult,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "./types"

export type PaymentCustomer = {
  readonly name: string
  readonly email: string
  readonly taxId: string
  readonly cellphone: string
}

type OneTimePaymentInputBase = {
  readonly amountInCents: number
  readonly externalReference?: string
  readonly metadata?: Readonly<Record<string, string>>
  readonly customer: PaymentCustomer
}

export type CreatePixPaymentInput = OneTimePaymentInputBase

export type CreateCardPaymentInput = OneTimePaymentInputBase & {
  /** Token de cartão de uso único emitido pelo provedor; nunca PAN/CVV. */
  readonly token: string
  readonly tokenIssuedAt: Date
  readonly installments?: number
}

export type ProviderPixPaymentOutcome = ProviderPixPaymentResult | IndeterminatePaymentResult
export type ProviderCardPaymentOutcome = ProviderCardPaymentResult | IndeterminatePaymentResult

export interface CustomerCapability {
  createCustomer(input: PaymentCustomer): Promise<{ readonly externalId: string }>
}

export interface CatalogCapability {
  syncProduct(input: { readonly name: string; readonly amountInCents: number }): Promise<void>
}

export interface OneTimePaymentCapability {
  createPixPayment(input: CreatePixPaymentInput): Promise<ProviderPixPaymentOutcome>
  createCardPayment(input: CreateCardPaymentInput): Promise<ProviderCardPaymentOutcome>
}

export interface PaymentQueryCapability {
  getStatus(input: {
    readonly externalId: string
    readonly method: PaymentMethod
  }): Promise<ProviderStatusResult>
  /**
   * Resolve the provider's charge id from an attempt-unique reference that was
   * sent at creation time (PIX: externalId; CARD: not supported by provider).
   * Returns null when the reference does not map to a charge (e.g. the
   * indeterminate call never created a charge on the provider side).
   */
  findPaymentIdByReference?(input: {
    readonly reference: string
    readonly method: PaymentMethod
  }): Promise<string | null>
}

export interface FullRefundCapability {
  refundFull(input: {
    readonly externalId: string
    readonly reason?: string
  }): Promise<{ readonly externalId: string; readonly status: "REFUNDED" }>
}

export type RawWebhookRequest = {
  readonly rawBody: string
  readonly signature: string | null
  readonly query: Readonly<Record<string, string | null>>
}

declare const verifiedWebhookBrand: unique symbol

/**
 * Webhook cuja verificação de transporte já ocorreu. O brand de tipo impede
 * que um objeto estrutural forjado seja aceito por `normalizeEvent`; apenas
 * `verifyRequest` deve produzi-lo.
 */
export type VerifiedWebhook = {
  readonly rawBody: string
  readonly environment: PaymentProviderEnvironment
  readonly [verifiedWebhookBrand]: true
}

export interface WebhookCapability {
  verifyRequest(input: RawWebhookRequest): VerifiedWebhook
  normalizeEvent(input: VerifiedWebhook): ProviderWebhookEvent | null
}

export type ProviderHealthCheckResult =
  | { readonly healthy: true }
  | { readonly healthy: false; readonly errorCode: string; readonly errorMessage: string }

/** Sondagem leve da conta do provider. Nunca lança nem expõe segredos. */
export interface HealthCheckCapability {
  checkHealth(): Promise<ProviderHealthCheckResult>
}

export interface PaymentProviderMetadata {
  readonly key: PaymentProviderKey
  readonly capabilities: readonly PaymentCapability[]
  readonly environment: PaymentProviderEnvironment
}
