import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { ChargeStatus } from "@/lib/payments/charge-status"
import type { ChargePurpose } from "@/lib/payments/types"
import type { ChargeLedger } from "./ChargeLedger"

/** Retrato do dono neutro (compra, regularização, adesão) no momento do espelho. */
export type OwnerChargeSnapshot = {
  readonly profileId: string
  readonly subscriptionId?: string | null
  readonly purpose: ChargePurpose
  readonly purposeRefId: string
  readonly status: ChargeStatus
  readonly amountCents: number
  readonly method?: string | null
}

export interface OwnerChargeSource {
  /** null quando o dono ainda não tem perfil (ex.: adesão cuja conta não foi criada). */
  snapshot(ownerType: string, ownerId: string): Promise<OwnerChargeSnapshot | null>
}

export type OwnerMirrorInput = {
  readonly ownerType: string
  readonly ownerId: string
  readonly externalId: string
  readonly paidAt: Date
}

/** Estado explícito (reembolso, disputa) que o dono ainda não reflete no próprio status. */
export type OwnerStatusMirrorInput = {
  readonly ownerType: string
  readonly ownerId: string
  readonly externalId: string
  readonly status: ChargeStatus
}

export type OwnerChargeMirrorDependencies = {
  readonly ledger: Pick<ChargeLedger, "record">
  readonly source: OwnerChargeSource
  readonly attempts: {
    findLatestAttemptByOwner(input: {
      ownerType: string
      ownerId: string
    }): Promise<StoredPaymentProviderAttemptRecord | null>
  }
  readonly logError?: (message: string, context: Record<string, unknown>) => void
}

/**
 * Espelha no ledger o pagamento de um dono já neutro. É observabilidade: NUNCA lança e nunca
 * altera o efeito de domínio de quem o chama (decisão 14).
 */
export class OwnerChargeMirror {
  constructor(private readonly dependencies: OwnerChargeMirrorDependencies) {}

  async mirrorSettled(input: OwnerMirrorInput): Promise<void> {
    try {
      await this.mirror(input, { status: undefined, paidAt: input.paidAt })
    } catch (error) {
      this.log("[OwnerChargeMirror] Error", input, error)
    }
  }

  /** Espelha reembolso/disputa: o status vem do evento, não do dono (que segue como "pago"). */
  async mirrorStatus(input: OwnerStatusMirrorInput): Promise<void> {
    try {
      await this.mirror(input, { status: input.status, paidAt: undefined })
    } catch (error) {
      this.log("[OwnerChargeMirror] Error", input, error)
    }
  }

  private async mirror(
    input: { ownerType: string; ownerId: string; externalId: string },
    override: { status: ChargeStatus | undefined; paidAt: Date | undefined },
  ): Promise<void> {
    const { source, attempts, ledger } = this.dependencies
    const snapshot = await source.snapshot(input.ownerType, input.ownerId)
    if (!snapshot) return
    const attempt = await attempts.findLatestAttemptByOwner({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
    })
    if (!attempt) return

    await ledger.record({
      profileId: snapshot.profileId,
      subscriptionId: snapshot.subscriptionId ?? null,
      purpose: snapshot.purpose,
      purposeRefId: snapshot.purposeRefId,
      status: override.status ?? snapshot.status,
      amountCents: snapshot.amountCents,
      method: snapshot.method ?? null,
      paidAt: override.paidAt,
      provider: attempt.provider,
      providerEnvironment: attempt.environment,
      providerContext: attempt.externalAccountContext,
      providerSessionId: attempt.sessionId,
      providerAttemptId: attempt.id,
      providerExternalId: input.externalId,
      idempotencyKey: `mirror:${input.ownerType}:${input.ownerId}`,
      source: "MIRROR",
    })
  }

  private log(message: string, input: { ownerType: string; ownerId: string }, error: unknown) {
    const logError = this.dependencies.logError ?? ((m, c) => console.error(m, c))
    logError(message, {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      reason: error instanceof Error ? error.message : "unknown",
    })
  }
}
