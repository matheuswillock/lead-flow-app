import type { PaymentCharge } from "@prisma/client"
import type {
  CreatePaymentChargeInput,
  IPaymentChargeRepository,
} from "@/app/api/infra/data/repositories/paymentCharge/IPaymentChargeRepository"
import type { ChargeStatus } from "@/lib/payments/charge-status"
import { canTransitionCharge } from "@/lib/payments/charge-transitions"

export type RecordChargeInput = Omit<CreatePaymentChargeInput, "actor" | "currency"> & {
  readonly currency?: string
  /** Quem originou o registro; padrão é a própria `source`. */
  readonly actor?: string
}

export type RecordChargeResult =
  | { readonly ok: true; readonly outcome: "created" | "transitioned" | "unchanged"; readonly charge: PaymentCharge }
  | { readonly ok: false; readonly reason: string }

export type TransitionChargeInput = {
  readonly chargeId: string
  readonly toStatus: ChargeStatus
  readonly rawStatus?: string | null
  readonly paidAt?: Date | null
  readonly actor: string
}

export type ChargeLedgerDependencies = {
  readonly charges: IPaymentChargeRepository
  readonly now?: () => Date
  readonly logError?: (message: string, context: Record<string, unknown>) => void
}

const PAID_STATUSES: ReadonlySet<ChargeStatus> = new Set(["CONFIRMED", "COMPLETED"])

/**
 * Escrita única do ledger de cobranças. `record` é para espelhos: idempotente e NUNCA lança, para
 * que uma falha do ledger não altere o efeito de domínio de quem o chama. `transition` é para quem
 * decide o estado (liquidação) e por isso propaga erros.
 */
export class ChargeLedger {
  private readonly now: () => Date
  private readonly logError: (message: string, context: Record<string, unknown>) => void

  constructor(private readonly dependencies: ChargeLedgerDependencies) {
    this.now = dependencies.now ?? (() => new Date())
    this.logError = dependencies.logError ?? ((message, context) => console.error(message, context))
  }

  async record(input: RecordChargeInput): Promise<RecordChargeResult> {
    try {
      assertValidInput(input)
      return await this.upsert(input)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown"
      this.logError("[ChargeLedger][record] Error", {
        reason,
        purpose: input.purpose,
        purposeRefId: input.purposeRefId ?? null,
        source: input.source,
        provider: input.provider,
        providerContext: input.providerContext,
        providerExternalId: input.providerExternalId ?? null,
      })
      return { ok: false, reason }
    }
  }

  async transition(input: TransitionChargeInput): Promise<PaymentCharge> {
    const { charges } = this.dependencies
    const current = await charges.findById(input.chargeId)
    if (!current) throw new Error("Cobrança não encontrada")
    if (current.status === input.toStatus) return current
    if (!canTransitionCharge(current.status as ChargeStatus, input.toStatus)) {
      throw new Error(`Transição de cobrança inválida: ${current.status} -> ${input.toStatus}`)
    }
    const moved = await charges.transition({
      id: current.id,
      expectedStatus: current.status as ChargeStatus,
      toStatus: input.toStatus,
      rawStatus: input.rawStatus,
      paidAt: input.paidAt ?? this.paidAtFor(input.toStatus),
      actor: input.actor,
    })
    if (moved) return moved
    // Outro processo venceu a corrida: se chegou ao mesmo destino, o resultado é idempotente.
    const reloaded = await charges.findById(input.chargeId)
    if (reloaded?.status === input.toStatus) return reloaded
    throw new Error("Cobrança alterada em paralelo")
  }

  private async upsert(input: RecordChargeInput): Promise<RecordChargeResult> {
    const existing = await this.findExisting(input)
    if (existing) return this.converge(existing, input)

    try {
      const charge = await this.dependencies.charges.create(this.toCreateInput(input))
      return { ok: true, outcome: "created", charge }
    } catch (error) {
      // Corrida de criação: a unicidade do banco é a autoridade; converge para a linha vencedora.
      const winner = await this.findExisting(input)
      if (!winner) throw error
      return this.converge(winner, input)
    }
  }

  private findExisting(input: RecordChargeInput): Promise<PaymentCharge | null> {
    const { charges } = this.dependencies
    const byExternal = input.providerExternalId
      ? charges.findByExternalIdentity({
          provider: input.provider,
          providerEnvironment: input.providerEnvironment,
          providerContext: input.providerContext,
          providerExternalId: input.providerExternalId,
        })
      : Promise.resolve(null)
    return byExternal.then(
      (found) =>
        found ??
        charges.findByIdempotencyKey({
          profileId: input.profileId,
          idempotencyKey: input.idempotencyKey,
        }),
    )
  }

  private async converge(
    existing: PaymentCharge,
    input: RecordChargeInput,
  ): Promise<RecordChargeResult> {
    const { charges } = this.dependencies
    let current = existing
    let outcome: "transitioned" | "unchanged" = "unchanged"

    if (canTransitionCharge(existing.status as ChargeStatus, input.status)) {
      const moved = await charges.transition({
        id: existing.id,
        expectedStatus: existing.status as ChargeStatus,
        toStatus: input.status,
        rawStatus: input.rawStatus ?? null,
        paidAt: input.paidAt ?? this.paidAtFor(input.status),
        actor: input.actor ?? input.source,
      })
      if (moved) {
        current = moved
        outcome = "transitioned"
      }
    }

    const filled = await charges.backfill(current.id, {
      providerSessionId: input.providerSessionId,
      providerAttemptId: input.providerAttemptId,
      providerExternalId: input.providerExternalId,
      paymentInstructions: input.paymentInstructions,
      paidAt: input.paidAt,
      rawStatus: outcome === "unchanged" && input.status === current.status ? input.rawStatus : undefined,
    })
    return { ok: true, outcome, charge: filled ?? current }
  }

  private toCreateInput(input: RecordChargeInput): CreatePaymentChargeInput {
    return {
      ...input,
      currency: input.currency ?? "BRL",
      paidAt: input.paidAt ?? this.paidAtFor(input.status),
      actor: input.actor ?? input.source,
    }
  }

  private paidAtFor(status: ChargeStatus): Date | undefined {
    return PAID_STATUSES.has(status) ? this.now() : undefined
  }
}

function assertValidInput(input: RecordChargeInput): void {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error("Valor da cobrança deve ser um inteiro em centavos")
  }
  if (!input.idempotencyKey.trim()) throw new Error("Cobrança exige chave de idempotência")
  if (!input.profileId.trim()) throw new Error("Cobrança exige perfil")
}
