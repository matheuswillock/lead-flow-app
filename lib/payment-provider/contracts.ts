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

export interface PaymentProviderMetadata {
  readonly key: PaymentProviderKey
  readonly capabilities: readonly PaymentCapability[]
  readonly environment: PaymentProviderEnvironment
}
