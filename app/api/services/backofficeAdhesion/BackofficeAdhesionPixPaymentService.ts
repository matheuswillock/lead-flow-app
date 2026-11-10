import type { BackofficeAdhesionPayment, Prisma } from "@prisma/client"
import type { IBackofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/IBackofficeAdhesionPaymentRepository"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type {
  CreateCardPaymentInput,
  CreatePixPaymentInput,
  ProviderCardPaymentOutcome,
  ProviderPixPaymentOutcome,
} from "@/lib/payment-provider/contracts"
import { OWNER_TYPE_BACKOFFICE_ADHESION } from "@/lib/payment-provider/owner-types"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type {
  AdhesionCardPaymentResult,
  AdhesionPixPayer,
  CreateAdhesionCardPaymentInput,
  CreateAdhesionPixPaymentInput,
  IBackofficeAdhesionPixPaymentService,
} from "./IBackofficeAdhesionPixPaymentService"

const ROUTE_VERSION = "BACKOFFICE-ADHESION-PIX-1"
const MIN_AMOUNT_CENTS = 100
const SESSION_TTL_MS = 30 * 60 * 1000
const LEASE_TTL_MS = 60_000

export const PIX_UNAVAILABLE_MESSAGE = "Não foi possível gerar o PIX agora. Tente novamente em instantes."
export const INCOMPLETE_PAYER_MESSAGE = "Dados do pagador incompletos"
export const PAYER_MISMATCH_MESSAGE =
  "Já existe um PIX aguardando pagamento para outro pagador. Aguarde o vencimento ou fale com o suporte."
export const INVALID_AMOUNT_MESSAGE = "Valor da adesão inválido para PIX"
/** Mensagem genérica de recusa: nunca repassa o detalhe do provider ao cliente. */
export const CARD_REFUSED_MESSAGE = "Não foi possível processar o pagamento com este cartão."
export const CARD_UNCONFIRMED_MESSAGE =
  "Não conseguimos confirmar o pagamento agora. Aguarde alguns minutos antes de tentar novamente."
export const CARD_PROCESSING_MESSAGE =
  "Já existe um pagamento no cartão em processamento. Aguarde a confirmação antes de tentar novamente."
export const CARD_INVALID_INSTALLMENTS_MESSAGE = "Parcelamento inválido para este pagamento."
const MIN_INSTALLMENT_CENTS = 1000
const MAX_INSTALLMENTS = 12
const CARD_PENDING_TTL_MS = 30 * 60 * 1000

export type SelectedAdhesionProvider = {
  provider: PaymentProviderKey
  environment: PaymentProviderEnvironment
  externalAccountContext: string
}

export interface AdhesionPixGateway {
  select(method?: "PIX" | "CARD"): Promise<SelectedAdhesionProvider>
  createPix(input: CreatePixPaymentInput): Promise<ProviderPixPaymentOutcome>
  createCard(input: CreateCardPaymentInput): Promise<ProviderCardPaymentOutcome>
  getCardStatus(externalId: string): Promise<{ status: string; amountInCents: number | null }>
}

export type BackofficeAdhesionPixPaymentDependencies = {
  payments: IBackofficeAdhesionPaymentRepository
  sessions: Pick<
    IPaymentProviderSessionRepository,
    "createSession" | "createAttempt" | "acquireAttemptLease" | "updateAttemptWithLease" | "releaseAttemptLease"
  >
  gateway: AdhesionPixGateway
  now?: () => Date
}

export class BackofficeAdhesionPixPaymentService implements IBackofficeAdhesionPixPaymentService {
  private readonly now: () => Date

  constructor(private readonly dependencies: BackofficeAdhesionPixPaymentDependencies) {
    this.now = dependencies.now ?? (() => new Date())
  }

  async createPixPayment(input: CreateAdhesionPixPaymentInput): Promise<BackofficeAdhesionPayment> {
    assertPayerComplete(input.payer)
    assertAmountAllowed(input.amountCents)

    const replay = await this.dependencies.payments.findByIdempotencyKey({
      adhesionId: input.adhesionId,
      idempotencyKey: input.idempotencyKey,
    })
    if (replay) return replay

    const existing = await this.resolveExistingPayment(input)
    if (existing) return existing

    // Cartão ainda em processamento pode ser aprovado a qualquer momento: abrir um PIX agora
    // deixaria duas cobranças válidas para a mesma adesão.
    const latest = await this.dependencies.payments.findLatestByAdhesion(input.adhesionId)
    if (latest && this.isPendingCard(latest)) throw new Error(CARD_PROCESSING_MESSAGE)

    // Seleciona o provider antes de persistir: provider indisponível não deixa linha órfã.
    const selected = await this.dependencies.gateway.select("PIX")
    const payment = await this.dependencies.payments.create({
      adhesionId: input.adhesionId,
      amountCents: input.amountCents,
      payerName: input.payer.name,
      payerEmail: input.payer.email,
      payerTaxId: input.payer.taxId,
      payerCellphone: input.payer.cellphone,
      provider: selected.provider,
      providerEnvironment: selected.environment,
      idempotencyKey: input.idempotencyKey,
    })
    const started = await this.startProviderAttempt(payment, selected, input, {
      method: "PIX",
      run: (reference) =>
        this.dependencies.gateway.createPix({
          amountInCents: input.amountCents,
          customer: input.payer,
          externalReference: reference.externalReference,
          metadata: reference.metadata,
        }),
    })
    return started.payment
  }

  async createCardPayment(input: CreateAdhesionCardPaymentInput): Promise<AdhesionCardPaymentResult> {
    assertPayerComplete(input.payer)
    assertAmountAllowed(input.amountCents)
    assertInstallmentsAllowed(input.amountCents, input.installments)
    if (!input.cardToken?.startsWith("ctok_")) throw new Error(CARD_REFUSED_MESSAGE)

    const replay = await this.dependencies.payments.findByIdempotencyKey({
      adhesionId: input.adhesionId,
      idempotencyKey: input.idempotencyKey,
    })
    if (replay) return this.replayCardPayment(replay)

    const latest = await this.dependencies.payments.findLatestByAdhesion(input.adhesionId)
    if (latest) {
      if (latest.status === "confirmed" || latest.status === "completed") {
        return { payment: latest, providerStatus: "CONFIRMED" }
      }
      if (this.isPendingCard(latest)) throw new Error(CARD_PROCESSING_MESSAGE)
      // PIX ainda válido: o cliente pode pagá-lo; trocar de método exige esperar o vencimento.
      if (this.isLivePending(latest)) throw new Error(PIX_PENDING_FOR_CARD_MESSAGE)
    }

    const selected = await this.dependencies.gateway.select("CARD")
    const payment = await this.dependencies.payments.create({
      adhesionId: input.adhesionId,
      amountCents: input.amountCents,
      payerName: input.payer.name,
      payerEmail: input.payer.email,
      payerTaxId: input.payer.taxId,
      payerCellphone: input.payer.cellphone,
      provider: selected.provider,
      providerEnvironment: selected.environment,
      idempotencyKey: input.idempotencyKey,
    })
    const started = await this.startProviderAttempt(
      payment,
      selected,
      { adhesionId: input.adhesionId, amountCents: input.amountCents },
      {
        method: "CARD",
        installments: input.installments,
        run: (reference) =>
          this.dependencies.gateway.createCard({
            amountInCents: input.amountCents,
            customer: input.payer,
            externalReference: reference.externalReference,
            metadata: reference.metadata,
            token: input.cardToken,
            // O token vale 60 s a partir da emissão no navegador; o provider recusa o expirado.
            tokenIssuedAt: this.now(),
            installments: input.installments,
          }),
      },
    )
    return {
      payment: started.payment,
      providerStatus: started.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
    }
  }

  async getCardProviderStatus(payment: BackofficeAdhesionPayment) {
    if (!payment.providerExternalId) return { status: "UNKNOWN", amountInCents: null }
    return this.dependencies.gateway.getCardStatus(payment.providerExternalId)
  }

  /** Repetição da mesma chave: devolve o resultado já registrado, nunca cobra de novo. */
  private replayCardPayment(payment: BackofficeAdhesionPayment): AdhesionCardPaymentResult {
    if (payment.status === "failed" || payment.status === "superseded") throw new Error(CARD_REFUSED_MESSAGE)
    if (payment.status === "pending" && !payment.providerExternalId) throw new Error(CARD_UNCONFIRMED_MESSAGE)
    return {
      payment,
      providerStatus: payment.status === "confirmed" || payment.status === "completed" ? "CONFIRMED" : "PENDING",
    }
  }

  private isPendingCard(payment: BackofficeAdhesionPayment): boolean {
    if (payment.status !== "pending" || readPaymentMethod(payment.paymentInstructions) !== "CARD") return false
    return this.now().getTime() - payment.createdAt.getTime() < CARD_PENDING_TTL_MS
  }

  findLatest(adhesionId: string): Promise<BackofficeAdhesionPayment | null> {
    return this.dependencies.payments.findLatestByAdhesion(adhesionId)
  }

  markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BackofficeAdhesionPayment | null> {
    return this.dependencies.payments.markConfirmed(input)
  }

  markCompleted(id: string): Promise<BackofficeAdhesionPayment | null> {
    return this.dependencies.payments.markCompleted(id, this.now())
  }

  async hasLivePendingPix(adhesionId: string): Promise<boolean> {
    const latest = await this.dependencies.payments.findLatestByAdhesion(adhesionId)
    return latest !== null && this.isLivePending(latest)
  }

  /**
   * Pagamento já existente que deve ser devolvido em vez de abrir outra cobrança: PIX
   * confirmado/concluído, ou PIX vivo do mesmo valor. PIX vivo de outro pagador é recusado:
   * sobrescrever o pagador de uma cobrança já emitida mudaria quem recebe a conta.
   */
  private async resolveExistingPayment(
    input: CreateAdhesionPixPaymentInput
  ): Promise<BackofficeAdhesionPayment | null> {
    const latest = await this.dependencies.payments.findLatestByAdhesion(input.adhesionId)
    if (!latest) return null
    if (latest.status === "confirmed" || latest.status === "completed") return latest
    if (!this.isLivePending(latest)) return null
    if (!isSamePayer(latest, input.payer)) throw new Error(PAYER_MISMATCH_MESSAGE)
    return latest.amountCents === input.amountCents ? latest : null
  }

  findById(id: string): Promise<BackofficeAdhesionPayment | null> {
    return this.dependencies.payments.findById(id)
  }

  supersedePending(adhesionId: string): Promise<number> {
    return this.dependencies.payments.supersedePending(adhesionId)
  }

  markNeedsReview(id: string, reason: string): Promise<BackofficeAdhesionPayment | null> {
    return this.dependencies.payments.markNeedsReview(id, reason)
  }

  private isLivePending(payment: BackofficeAdhesionPayment): boolean {
    if (payment.status !== "pending") return false
    const expiresAt = readPixExpiration(payment.paymentInstructions)
    return expiresAt !== null && expiresAt > this.now().getTime()
  }

  private async startProviderAttempt(
    payment: BackofficeAdhesionPayment,
    selected: SelectedAdhesionProvider,
    input: { adhesionId: string; amountCents: number },
    charge: ProviderCharge,
  ): Promise<{ payment: BackofficeAdhesionPayment; status: string }> {
    const { sessions, payments } = this.dependencies
    const owner = {
      tenantId: input.adhesionId,
      ownerType: OWNER_TYPE_BACKOFFICE_ADHESION,
      ownerId: payment.id,
    }
    // A unicidade das tentativas do provider é global: a chave deriva do pagamento (único),
    // nunca da chave enviada pelo cliente.
    const providerIdempotencyKey = `backoffice-adhesion:${payment.id}`
    const providerContext = {
      provider: selected.provider,
      environment: selected.environment,
      externalAccountContext: selected.externalAccountContext,
    }
    const session = await sessions.createSession({
      ...owner,
      ...providerContext,
      idempotencyKey: providerIdempotencyKey,
      route: "NEW_ROUTER",
      routeVersion: ROUTE_VERSION,
      expiresAt: new Date(this.now().getTime() + SESSION_TTL_MS),
    })
    const attempt = await sessions.createAttempt({
      ...owner,
      ...providerContext,
      sessionId: session.id,
      now: this.now(),
      attemptNumber: 1,
      idempotencyKey: providerIdempotencyKey,
      requestFingerprint: JSON.stringify({
        amountCents: input.amountCents,
        method: charge.method,
        adhesionId: input.adhesionId,
        ...(charge.method === "CARD" ? { installments: charge.installments } : {}),
      }),
    })
    const leased = await sessions.acquireAttemptLease({
      attemptId: attempt.id,
      ...owner,
      purpose: "PAYMENT",
      now: this.now(),
      ttlMs: LEASE_TTL_MS,
    })

    let outcome: ProviderPixPaymentOutcome | ProviderCardPaymentOutcome
    try {
      outcome = await charge.run({
        externalReference: `${payment.id}:${attempt.id}`,
        metadata: { adhesionPaymentId: payment.id, attemptId: attempt.id },
      })
    } catch (error) {
      await this.abandonAttempt(payment.id, leased, error)
      // Recusa do cartão: mensagem genérica; o detalhe do provider fica só no log do servidor.
      if (charge.method === "CARD") {
        console.error("[BackofficeAdhesionPixPaymentService][card]", error instanceof Error ? error.name : "erro")
        throw new Error(CARD_REFUSED_MESSAGE)
      }
      throw error
    }

    const updated = await sessions.updateAttemptWithLease({
      attemptId: leased.id,
      ...owner,
      lease: leased.lease,
      now: this.now(),
      expectedStatus: "CREATED",
      operation: "PAYMENT",
      status: outcome.status,
      externalId: outcome.externalId,
      ...(outcome.status === "UNKNOWN"
        ? {
            unknownReason: outcome.reason,
            ...(outcome.reconciliationReference
              ? { reconciliationReference: outcome.reconciliationReference }
              : {}),
          }
        : charge.method === "PIX" && "pix" in outcome && outcome.pix
          ? { paymentInstructions: outcome.pix }
          : {}),
    })
    const attached = await payments.attachProviderAttempt({
      id: payment.id,
      providerSessionId: session.id,
      providerAttemptId: updated.id,
      providerExternalId: updated.externalId,
      ...(charge.method === "CARD"
        ? {
            paymentInstructions: {
              method: "CARD",
              installments: charge.installments,
            } as unknown as Prisma.InputJsonValue,
          }
        : updated.paymentInstructions
          ? { paymentInstructions: updated.paymentInstructions as unknown as Prisma.InputJsonValue }
          : {}),
    })
    // UNKNOWN: a linha segue vinculada à tentativa para a reconciliação do cron; o cliente
    // não recebe QR e pode tentar de novo (um pagamento tardio ainda conclui a adesão).
    if (outcome.status === "UNKNOWN") {
      throw new Error(charge.method === "CARD" ? CARD_UNCONFIRMED_MESSAGE : PIX_UNAVAILABLE_MESSAGE)
    }
    if (charge.method === "CARD" && outcome.status !== "CONFIRMED" && outcome.status !== "PENDING") {
      await payments.markFailed(payment.id, `card_${outcome.status.toLowerCase()}`)
      throw new Error(CARD_REFUSED_MESSAGE)
    }
    return { payment: attached, status: outcome.status }
  }

  private async abandonAttempt(
    paymentId: string,
    leased: { id: string; lease: Parameters<BackofficeAdhesionPixPaymentDependencies["sessions"]["releaseAttemptLease"]>[0]["lease"] },
    error: unknown,
  ): Promise<void> {
    await this.dependencies.sessions
      .releaseAttemptLease({ attemptId: leased.id, lease: leased.lease, now: this.now() })
      .catch((releaseError: unknown) => {
        console.error("[BackofficeAdhesionPixPaymentService][release]", { paymentId, releaseError })
      })
    await this.dependencies.payments.markFailed(
      paymentId,
      error instanceof Error ? error.message.slice(0, 200) : "provider_error",
    )
  }
}

const PIX_PENDING_FOR_CARD_MESSAGE =
  "Já existe um PIX aguardando pagamento. Pague-o ou aguarde o vencimento para trocar a forma de pagamento."

type ProviderCharge = {
  method: "PIX" | "CARD"
  installments?: number
  run: (reference: {
    externalReference: string
    metadata: Record<string, string>
  }) => Promise<ProviderPixPaymentOutcome | ProviderCardPaymentOutcome>
}

function assertInstallmentsAllowed(amountCents: number, installments: number): void {
  if (
    !Number.isInteger(installments) ||
    installments < 1 ||
    installments > MAX_INSTALLMENTS ||
    Math.floor(amountCents / installments) < MIN_INSTALLMENT_CENTS
  ) {
    throw new Error(CARD_INVALID_INSTALLMENTS_MESSAGE)
  }
}

/** Método gravado na linha: o cartão guarda `{ method: "CARD" }` nas instruções; o PIX guarda o QR. */
export function readPaymentMethod(instructions: unknown): "CARD" | "PIX" {
  if (instructions && typeof instructions === "object" && (instructions as { method?: unknown }).method === "CARD") {
    return "CARD"
  }
  return "PIX"
}

function isSamePayer(payment: BackofficeAdhesionPayment, payer: AdhesionPixPayer): boolean {
  return (
    payment.payerEmail.trim().toLowerCase() === payer.email.trim().toLowerCase() &&
    payment.payerTaxId === payer.taxId
  )
}

function assertPayerComplete(payer: AdhesionPixPayer): void {
  const complete = [payer.name, payer.email, payer.taxId, payer.cellphone].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  )
  if (!complete) throw new Error(INCOMPLETE_PAYER_MESSAGE)
}

function assertAmountAllowed(amountCents: number): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < MIN_AMOUNT_CENTS) {
    throw new Error(INVALID_AMOUNT_MESSAGE)
  }
}

function readPixExpiration(instructions: unknown): number | null {
  if (!instructions || typeof instructions !== "object") return null
  const expiresAt = (instructions as { expiresAt?: unknown }).expiresAt
  if (typeof expiresAt !== "string") return null
  const parsed = Date.parse(expiresAt)
  return Number.isFinite(parsed) ? parsed : null
}
