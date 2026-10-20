import { createHmac, timingSafeEqual } from "node:crypto"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import type {
  CreateCardPaymentInput,
  CreatePixPaymentInput,
  FullRefundCapability,
  OneTimePaymentCapability,
  PaymentCustomer,
  PaymentProviderMetadata,
  PaymentQueryCapability,
  ProviderCardPaymentOutcome,
  ProviderPixPaymentOutcome,
  RawWebhookRequest,
  VerifiedWebhook,
  WebhookCapability,
} from "@/lib/payment-provider/contracts"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import {
  PAYMENT_CAPABILITIES,
  assertPositiveCents,
  createIndeterminatePaymentResult,
  freezePaymentValue,
  mapProviderStatus,
} from "@/lib/payment-provider/types"
import type {
  IndeterminatePaymentResult,
  PaymentMethod,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "@/lib/payment-provider/types"
import { PaymentProviderBase, type PaymentProviderDependencies } from "./PaymentProviderBase"

type AbacateCreateResponse = {
  success?: unknown
  data?: {
    id?: unknown
    status?: unknown
    amount?: unknown
    brCode?: unknown
    brCodeBase64?: unknown
    expiresAt?: unknown
  }
}

type AbacateStatusResponse = {
  success?: unknown
  data?: { id?: unknown; status?: unknown; amount?: unknown; method?: unknown }
}

type AbacateProviderDependencies = PaymentProviderDependencies

type AbacateTransparentRequest = {
  readonly amountInCents: number
  readonly customer: PaymentCustomer
  readonly method: PaymentMethod
  readonly token?: string
  readonly installments?: number
  readonly externalReference?: string
  readonly metadata?: Readonly<Record<string, string>>
}

export class AbacatePayProvider
  extends PaymentProviderBase<PaymentProviderConfig>
  implements
    OneTimePaymentCapability,
    PaymentQueryCapability,
    FullRefundCapability,
    WebhookCapability
{
  private readonly verifiedWebhooks = new WeakSet<object>()

  readonly metadata: PaymentProviderMetadata

  constructor(config: PaymentProviderConfig, dependencies: AbacateProviderDependencies = {}) {
    super("ABACATE_PAY", config.environment, config, dependencies)
    this.metadata = Object.freeze({
      key: "ABACATE_PAY",
      environment: config.environment,
      capabilities: Object.freeze([
        PAYMENT_CAPABILITIES.PIX,
        PAYMENT_CAPABILITIES.CARD,
        PAYMENT_CAPABILITIES.STATUS_QUERY,
        PAYMENT_CAPABILITIES.FULL_REFUND,
        PAYMENT_CAPABILITIES.WEBHOOK,
      ]),
    })
  }

  async createPixPayment(input: CreatePixPaymentInput): Promise<ProviderPixPaymentOutcome> {
    try {
      assertPositiveCents(input.amountInCents)
      validateCustomer(input.customer)
      return freezePaymentValue(await this.createPix(input))
    } catch (error) {
      return this.toIndeterminateOrThrow(error, input.externalReference)
    }
  }

  async createCardPayment(input: CreateCardPaymentInput): Promise<ProviderCardPaymentOutcome> {
    try {
      assertPositiveCents(input.amountInCents)
      validateCustomer(input.customer)
      return freezePaymentValue(await this.createCard(input))
    } catch (error) {
      return this.toIndeterminateOrThrow(error, input.externalReference)
    }
  }

  private toIndeterminateOrThrow(
    error: unknown,
    externalReference: string | undefined,
  ): IndeterminatePaymentResult {
    const providerError = this.providerError(error)
    if (providerError.code === "REMOTE_TIMEOUT" || providerError.retryable) {
      return createIndeterminatePaymentResult({
        reason: providerError.code === "REMOTE_TIMEOUT" ? "REMOTE_TIMEOUT" : "REMOTE_ERROR",
        reconciliationReference: externalReference,
      })
    }
    throw providerError
  }

  async getStatus(input: {
    readonly externalId: string
    readonly method: PaymentMethod
  }): Promise<ProviderStatusResult> {
    if (input.method !== "PIX" && input.method !== "CARD") {
      throw new PaymentProviderError("VALIDATION_FAILED", "método de pagamento inválido")
    }
    if (!isCanonicalIdentifier(input.externalId)) {
      throw new PaymentProviderError("VALIDATION_FAILED", "ID externo inválido")
    }
    const path = input.method === "PIX" ? "/v2/transparents/check" : "/v2/transparents/get"
    let response: AbacateStatusResponse
    try {
      response = await this.requestJson<AbacateStatusResponse>(
        `${path}?id=${encodeURIComponent(input.externalId)}`,
        {
          method: "GET",
          headers: this.authHeaders(),
        },
      )
    } catch (error) {
      const providerError = this.providerError(error)
      if (providerError.code === "REMOTE_TIMEOUT" || providerError.retryable) {
        return freezePaymentValue({
          externalId: input.externalId,
          method: input.method,
          status: "UNKNOWN",
          reason: providerError.code === "REMOTE_TIMEOUT" ? "REMOTE_TIMEOUT" : "REMOTE_ERROR",
          amountInCents: null,
          currency: "BRL",
          requiresReconciliation: true,
        })
      }
      throw providerError
    }
    const data = response.data ?? {}
    if (response.success === false) {
      throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "O provedor recusou a consulta")
    }
    const status = mapProviderStatus(data.status)
    const remoteExternalId = stringOrNull(data.id)
    if (remoteExternalId === null) {
      return freezePaymentValue({
        externalId: input.externalId,
        method: input.method,
        status: "UNKNOWN",
        reason: "MISSING_EXTERNAL_ID",
        amountInCents: null,
        currency: "BRL",
        requiresReconciliation: true,
      })
    }
    if (remoteExternalId !== input.externalId) {
      throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "ID externo divergente")
    }
    const result = {
      externalId: remoteExternalId,
      method: input.method,
      amountInCents: parseOptionalRemoteAmount(data.amount, "valor remoto"),
      currency: "BRL" as const,
    }
    return freezePaymentValue(
      status === "UNKNOWN"
        ? { ...result, status, reason: "REMOTE_ERROR", requiresReconciliation: true }
        : { ...result, status },
    )
  }

  async findPaymentIdByReference(input: {
    readonly reference: string
    readonly method: PaymentMethod
  }): Promise<string | null> {
    if (!isCanonicalIdentifier(input.reference)) {
      throw new PaymentProviderError("VALIDATION_FAILED", "Referência inválida")
    }
    if (input.method !== "PIX" && input.method !== "CARD") {
      throw new PaymentProviderError("VALIDATION_FAILED", "método de pagamento inválido")
    }
    const params = new URLSearchParams({
      externalId: input.reference,
      method: input.method,
      limit: "1",
    })
    try {
      const response = await this.requestJson<{
        success?: unknown
        data?: ReadonlyArray<{ id?: unknown }>
      }>(`/v2/transparents/list?${params}`, {
        method: "GET",
        headers: this.authHeaders(),
      })
      if (response.success === false) {
        throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "O provedor recusou a consulta")
      }
      const items = response.data ?? []
      if (items.length === 0) return null
      const chargeId = stringOrNull(items[0].id)
      if (chargeId === null) return null
      return chargeId
    } catch (error) {
      const providerError = this.providerError(error)
      if (providerError.retryable || providerError.code === "REMOTE_TIMEOUT") {
        throw providerError
      }
      throw new PaymentProviderError(
        "REMOTE_REQUEST_FAILED",
        "Falha ao consultar cobrança por referência",
      )
    }
  }

  async refundFull(input: {
    readonly externalId: string
    readonly reason?: string
  }): Promise<{ readonly externalId: string; readonly status: "REFUNDED" }> {
    if (!isCanonicalIdentifier(input.externalId)) {
      throw new PaymentProviderError("VALIDATION_FAILED", "ID externo inválido")
    }
    try {
      const response = await this.requestJson<{ success?: unknown; data?: { id?: unknown } }>(
        "/v2/transparents/refund",
        {
          method: "POST",
          headers: { ...this.authHeaders(), "content-type": "application/json" },
          body: JSON.stringify({
            id: input.externalId,
            ...(input.reason ? { reason: input.reason } : {}),
          }),
        },
        { indeterminateOnSuccessParseError: true },
      )
      const refundExternalId = stringOrNull(response.data?.id)
      if (response.success === false) {
        throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "O provedor recusou o reembolso")
      }
      if (refundExternalId === null) {
        throw new PaymentProviderError(
          "UNKNOWN_RESULT",
          "Resultado do reembolso sem ID remoto",
          true,
        )
      }
      if (refundExternalId !== input.externalId) {
        throw new PaymentProviderError("UNKNOWN_RESULT", "ID do reembolso divergente", true)
      }
      return freezePaymentValue({
        externalId: refundExternalId,
        status: "REFUNDED",
      })
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.remoteCode === "ALREADY_REFUNDED" &&
        error.remoteStatus === 409
      ) {
        return freezePaymentValue({ externalId: input.externalId, status: "REFUNDED" })
      }
      const providerError = this.providerError(error)
      if (providerError.retryable || providerError.code === "UNKNOWN_RESULT") {
        throw new PaymentProviderError(
          "UNKNOWN_RESULT",
          "Resultado do reembolso indeterminado",
          true,
        )
      }
      throw providerError
    }
  }

  verifyRequest(input: RawWebhookRequest): VerifiedWebhook {
    const signature = input.signature
    const configuredSecret = this.config.webhookSecret
    const secretMatches =
      configuredSecret.length > 0 &&
      constantTimeEqual(input.query.webhookSecret ?? "", configuredSecret)
    if (!secretMatches) {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Webhook não autenticado")
    }
    // Sem chave pública (loja sem cartão liberado) o HMAC não é verificável; a origem
    // continua autenticada pelo secret da URL. Com a chave configurada o HMAC é obrigatório.
    const signingKey = this.config.webhookSigningKey
    if (signingKey !== null) {
      if (typeof signature !== "string") {
        throw new PaymentProviderError("WEBHOOK_INVALID", "Webhook não autenticado")
      }
      const expected = createHmac("sha256", signingKey).update(input.rawBody).digest("base64")
      const actual = Buffer.from(signature)
      const expectedBuffer = Buffer.from(expected)
      if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
        throw new PaymentProviderError("WEBHOOK_INVALID", "Webhook não autenticado")
      }
    }
    const verified = {
      rawBody: input.rawBody,
      environment: this.environment,
    }
    this.verifiedWebhooks.add(verified)
    return Object.freeze(verified) as VerifiedWebhook
  }

  normalizeEvent(input: VerifiedWebhook): ProviderWebhookEvent | null {
    if (!this.verifiedWebhooks.has(input as object)) {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Webhook não verificado")
    }
    const envelope = parseEnvelope(input.rawBody)
    if (this.environment !== input.environment) {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Ambiente da configuração incompatível")
    }
    if (envelope.devMode !== (input.environment === "DEV")) {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Ambiente do webhook incompatível")
    }
    const event = envelope.event
    if (!event.startsWith("transparent.")) return null
    if (
      !(
        ["transparent.completed", "transparent.refunded", "transparent.disputed"] as string[]
      ).includes(event)
    )
      return null

    const data = asRecord(envelope.data)
    const transparent = asRecord(data.transparent ?? data)
    const status = mapProviderStatus(transparent.status)
    assertCompatibleWebhookStatus(event, status)
    const normalizedEvent: ProviderWebhookEvent["event"] =
      event === "transparent.completed"
        ? "PAYMENT_CONFIRMED"
        : event === "transparent.refunded"
          ? "PAYMENT_REFUNDED"
          : "PAYMENT_DISPUTED"
    const externalPaymentId = stringOrNull(transparent.id ?? transparent.paymentId)
    // Extract attemptId from metadata if present (signed by the provider, so
    // trustworthy for correlating an indeterminate initiation).
    const metadata = asRecord(transparent.metadata)
    const attemptId = typeof metadata?.attemptId === "string" &&
      isCanonicalIdentifier(metadata.attemptId)
      ? metadata.attemptId
      : undefined
    const result = {
      eventId: envelope.id,
      event: normalizedEvent,
      environment: input.environment,
      externalPaymentId,
      method: toMethod(transparent.method),
      amountInCents: parseOptionalRemoteAmount(transparent.amount, "valor do webhook"),
      occurredAt: parseWebhookDate(transparent.updatedAt ?? transparent.createdAt),
      disputeEpoch: numberOrNull(transparent.disputeEpoch),
      attemptId,
    }
    if (externalPaymentId === null) {
      return freezePaymentValue({
        ...result,
        status: "UNKNOWN",
        reason: "MISSING_EXTERNAL_ID",
        requiresReconciliation: true,
      })
    }
    const bindableResult = { ...result, externalPaymentId }
    return freezePaymentValue(
      status === "UNKNOWN"
        ? { ...bindableResult, status, reason: "REMOTE_ERROR", requiresReconciliation: true }
        : { ...bindableResult, status },
    )
  }

  private async createPix(input: CreatePixPaymentInput): Promise<ProviderPixPaymentOutcome> {
    const response = await this.createTransparent({ ...input, method: "PIX" })
    const data = response.data ?? {}
    const externalId = stringOrNull(data.id)
    const status = mapProviderStatus(data.status)
    if (status === "UNKNOWN") {
      return createIndeterminatePaymentResult({
        reason: "REMOTE_ERROR",
        externalId,
        reconciliationReference: input.externalReference,
      })
    }
    if (externalId === null) {
      return createIndeterminatePaymentResult({
        reason: "MISSING_EXTERNAL_ID",
        reconciliationReference: input.externalReference,
      })
    }
    const amountInCents = requireMatchingRemoteAmount(data.amount, input.amountInCents)
    return {
      externalId,
      method: "PIX",
      status,
      amountInCents,
      currency: "BRL",
      pix: {
        brCode: requireString(data.brCode, "BR Code PIX"),
        brCodeBase64: requireString(data.brCodeBase64, "BR Code Base64 PIX"),
        expiresAt: requireValidProviderDate(data.expiresAt, "expiração do PIX"),
      },
    }
  }

  private async createCard(input: CreateCardPaymentInput): Promise<ProviderCardPaymentOutcome> {
    if (!input.token?.startsWith("ctok_"))
      throw new PaymentProviderError("VALIDATION_FAILED", "Token de cartão inválido")
    const now = this.now().getTime()
    if (!Number.isFinite(now)) {
      throw new PaymentProviderError("VALIDATION_FAILED", "relógio interno inválido")
    }
    const tokenIssuedAt =
      input.tokenIssuedAt instanceof Date ? input.tokenIssuedAt.getTime() : Number.NaN
    if (!Number.isFinite(tokenIssuedAt) || now - tokenIssuedAt > 60_000) {
      throw new PaymentProviderError("VALIDATION_FAILED", "Token de cartão expirado")
    }
    if (tokenIssuedAt > now) {
      throw new PaymentProviderError("VALIDATION_FAILED", "Token de cartão inválido")
    }
    const installments = input.installments ?? 1
    if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
      throw new PaymentProviderError("VALIDATION_FAILED", "Parcelamento inválido")
    }
    if (Math.floor(input.amountInCents / installments) < 1000) {
      throw new PaymentProviderError(
        "VALIDATION_FAILED",
        "Cada parcela deve ter no mínimo 1000 centavos",
      )
    }
    const response = await this.createTransparent({ ...input, method: "CARD" })
    const data = response.data ?? {}
    const externalId = stringOrNull(data.id)
    const status = mapProviderStatus(data.status)
    if (status === "UNKNOWN") {
      return createIndeterminatePaymentResult({
        reason: "REMOTE_ERROR",
        externalId,
        reconciliationReference: input.externalReference,
      })
    }
    if (externalId === null) {
      return createIndeterminatePaymentResult({
        reason: "MISSING_EXTERNAL_ID",
        reconciliationReference: input.externalReference,
      })
    }
    const amountInCents = requireMatchingRemoteAmount(data.amount, input.amountInCents)
    return {
      externalId,
      method: "CARD",
      status,
      amountInCents,
      currency: "BRL",
    }
  }

  private async createTransparent(
    input: AbacateTransparentRequest,
  ): Promise<AbacateCreateResponse> {
    const data: Record<string, unknown> = {
      amount: input.amountInCents,
      customer: input.customer,
      // PIX carrega `externalId` para reconciliação; CARD não depende dele (regra do provider).
      ...(input.method === "PIX" && input.externalReference
        ? { externalId: input.externalReference }
        : {}),
      ...(input.token ? { token: input.token } : {}),
      ...(input.method === "CARD" ? { installmentCount: input.installments ?? 1 } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }
    const response = await this.requestJson<AbacateCreateResponse>(
      "/v2/transparents/create",
      {
        method: "POST",
        headers: { ...this.authHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ method: input.method, data }),
      },
      { indeterminateOnSuccessParseError: true },
    )
    if (response.success === false) {
      throw new PaymentProviderError(
        "REMOTE_REQUEST_FAILED",
        "O provedor recusou a criação da cobrança",
      )
    }
    return response
  }

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiKey}` }
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", `Resposta sem ${label}`)
  return value
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && isCanonicalIdentifier(value) ? value : null
}

function isCanonicalIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim() && !/\s/.test(value)
  )
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null
}

function toCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (!Number.isInteger(value) && Math.round(value * 100) / 100 !== value) return null
  const cents = Number.isInteger(value) ? value : Math.round(value * 100)
  return Number.isSafeInteger(cents) && cents >= 100 ? cents : null
}

function parseOptionalRemoteAmount(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null
  const cents = toCents(value)
  if (cents === null) {
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", `${label} inválido`)
  }
  return cents
}

function requireMatchingRemoteAmount(value: unknown, requestedAmountInCents: number): number {
  const remoteAmountInCents = parseOptionalRemoteAmount(value, "valor remoto")
  if (remoteAmountInCents === null) {
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "valor remoto ausente")
  }
  if (remoteAmountInCents !== requestedAmountInCents) {
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "valor remoto divergente")
  }
  return remoteAmountInCents
}

function requireValidProviderDate(value: unknown, label: string): string {
  if (!isStrictUtcDate(value)) {
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", `${label} inválida`)
  }
  return value as string
}

function parseWebhookDate(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!isStrictUtcDate(value)) {
    throw new PaymentProviderError("WEBHOOK_INVALID", "data de ocorrência inválida")
  }
  return value as string
}

function assertCompatibleWebhookStatus(
  event: string,
  status: ReturnType<typeof mapProviderStatus>,
): void {
  if (status === "UNKNOWN") return
  const compatible =
    (event === "transparent.completed" && status === "CONFIRMED") ||
    (event === "transparent.refunded" && status === "REFUNDED") ||
    (event === "transparent.disputed" &&
      (status === "DISPUTED" || status === "CONFIRMED" || status === "REFUNDED"))
  if (!compatible) {
    throw new PaymentProviderError("WEBHOOK_INVALID", "evento e status do webhook incompatível")
  }
}

function isStrictUtcDate(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/.exec(value)
  if (!match) return false
  const [, year, month, day, hour, minute, second, milliseconds = "0"] = match
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(milliseconds),
    ),
  )
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second) &&
    date.getUTCMilliseconds() === Number(milliseconds)
  )
}

function toMethod(value: unknown): PaymentMethod | null {
  return value === "PIX" || value === "CARD" ? value : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
}

function parseEnvelope(rawBody: string): {
  id: string
  event: string
  devMode: boolean
  data: unknown
} {
  let envelope: Record<string, unknown>
  try {
    envelope = asRecord(JSON.parse(rawBody))
  } catch {
    throw new PaymentProviderError("WEBHOOK_INVALID", "Envelope de webhook inválido")
  }
  if (
    !isCanonicalIdentifier(envelope.id) ||
    typeof envelope.event !== "string" ||
    typeof envelope.devMode !== "boolean"
  ) {
    throw new PaymentProviderError("WEBHOOK_INVALID", "Envelope de webhook inválido")
  }
  return { id: envelope.id, event: envelope.event, devMode: envelope.devMode, data: envelope.data }
}

function validateCustomer(customer: PaymentCustomer): void {
  if (
    typeof customer !== "object" ||
    customer === null ||
    [customer.name, customer.email, customer.taxId, customer.cellphone].some(
      (value) => typeof value !== "string" || value.trim() === "",
    )
  ) {
    throw new PaymentProviderError("VALIDATION_FAILED", "Dados do cliente incompletos")
  }
}
