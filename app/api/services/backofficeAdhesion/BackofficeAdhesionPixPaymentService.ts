import type { BackofficeAdhesionPayment, Prisma } from "@prisma/client"
import type { IBackofficeAdhesionPaymentRepository } from "@/app/api/infra/data/repositories/backofficeAdhesionPayment/IBackofficeAdhesionPaymentRepository"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { CreatePixPaymentInput, ProviderPixPaymentOutcome } from "@/lib/payment-provider/contracts"
import { OWNER_TYPE_BACKOFFICE_ADHESION } from "@/lib/payment-provider/owner-types"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type {
  AdhesionPixPayer,
  CreateAdhesionPixPaymentInput,
  IBackofficeAdhesionPixPaymentService,
} from "./IBackofficeAdhesionPixPaymentService"

const ROUTE_VERSION = "BACKOFFICE-ADHESION-PIX-1"
const MIN_AMOUNT_CENTS = 100
const SESSION_TTL_MS = 30 * 60 * 1000
const LEASE_TTL_MS = 60_000

export const PIX_UNAVAILABLE_MESSAGE = "Não foi possível gerar o PIX agora. Tente novamente em instantes."
export const INCOMPLETE_PAYER_MESSAGE = "Dados do pagador incompletos"
export const INVALID_AMOUNT_MESSAGE = "Valor da adesão inválido para PIX"

export type SelectedAdhesionProvider = {
  provider: PaymentProviderKey
  environment: PaymentProviderEnvironment
  externalAccountContext: string
}

export interface AdhesionPixGateway {
  select(): Promise<SelectedAdhesionProvider>
  createPix(input: CreatePixPaymentInput): Promise<ProviderPixPaymentOutcome>
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

    const reusable = await this.findReusablePending(input.adhesionId, input.amountCents)
    if (reusable) return reusable

    // Seleciona o provider antes de persistir: provider indisponível não deixa linha órfã.
    const selected = await this.dependencies.gateway.select()
    const payment = await this.dependencies.payments.create({
      adhesionId: input.adhesionId,
      amountCents: input.amountCents,
      provider: selected.provider,
      providerEnvironment: selected.environment,
      idempotencyKey: input.idempotencyKey,
    })
    return this.startProviderAttempt(payment, selected, input)
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

  private async findReusablePending(adhesionId: string, amountCents: number) {
    const latest = await this.dependencies.payments.findLatestByAdhesion(adhesionId)
    if (!latest || latest.amountCents !== amountCents) return null
    return this.isLivePending(latest) ? latest : null
  }

  private isLivePending(payment: BackofficeAdhesionPayment): boolean {
    if (payment.status !== "pending") return false
    const expiresAt = readPixExpiration(payment.paymentInstructions)
    return expiresAt !== null && expiresAt > this.now().getTime()
  }

  private async startProviderAttempt(
    payment: BackofficeAdhesionPayment,
    selected: SelectedAdhesionProvider,
    input: CreateAdhesionPixPaymentInput,
  ): Promise<BackofficeAdhesionPayment> {
    const { sessions, gateway, payments } = this.dependencies
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
        method: "PIX",
        adhesionId: input.adhesionId,
      }),
    })
    const leased = await sessions.acquireAttemptLease({
      attemptId: attempt.id,
      ...owner,
      purpose: "PAYMENT",
      now: this.now(),
      ttlMs: LEASE_TTL_MS,
    })

    let outcome: ProviderPixPaymentOutcome
    try {
      outcome = await gateway.createPix({
        amountInCents: input.amountCents,
        customer: input.payer,
        externalReference: `${payment.id}:${attempt.id}`,
        metadata: { adhesionPaymentId: payment.id, attemptId: attempt.id },
      })
    } catch (error) {
      await this.abandonAttempt(payment.id, leased, error)
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
        : { paymentInstructions: outcome.pix }),
    })
    const attached = await payments.attachProviderAttempt({
      id: payment.id,
      providerSessionId: session.id,
      providerAttemptId: updated.id,
      providerExternalId: updated.externalId,
      ...(updated.paymentInstructions
        ? { paymentInstructions: updated.paymentInstructions as unknown as Prisma.InputJsonValue }
        : {}),
    })
    // UNKNOWN: a linha segue vinculada à tentativa para a reconciliação do cron; o cliente
    // não recebe QR e pode tentar de novo (um pagamento tardio ainda conclui a adesão).
    if (outcome.status === "UNKNOWN") throw new Error(PIX_UNAVAILABLE_MESSAGE)
    return attached
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
