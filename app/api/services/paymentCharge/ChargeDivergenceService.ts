import type { PaymentCharge } from "@prisma/client"
import type { IPaymentChargeRepository } from "@/app/api/infra/data/repositories/paymentCharge/IPaymentChargeRepository"
import type { ChargeStatus } from "@/lib/payments/charge-status"

export type ChargeSourceSnapshot = {
  readonly amountCents: number | null
  readonly status: ChargeStatus | null
}

export type ChargeSourceReader = {
  /** Estado da fonte (webhook do Asaas, tentativa/dono do router); null = fonte ausente. */
  read(charge: PaymentCharge): Promise<ChargeSourceSnapshot | null>
  /** Pagamentos do Asaas recebidos pelo webhook na janela, para achar os que faltam no ledger. */
  listExpectedShadowPayments(input: {
    since: Date
    limit: number
  }): Promise<ReadonlyArray<{ account: "primary" | "legacy"; paymentId: string }>>
}

export type Divergence = {
  readonly chargeId: string | null
  readonly kind: "AMOUNT" | "STATUS" | "MISSING_SOURCE" | "MISSING_CHARGE"
  readonly ledger: number | string | null
  readonly source: number | string | null
}

export type DivergenceRunResult = {
  readonly checked: number
  readonly divergences: readonly Divergence[]
  readonly truncated: boolean
}

export type ChargeDivergenceDependencies = {
  readonly charges: IPaymentChargeRepository
  readonly source: ChargeSourceReader
  readonly report: (divergences: readonly Divergence[]) => void
  readonly asaasEnvironment: () => string
  readonly now?: () => Date
}

const PAID: ReadonlySet<ChargeStatus> = new Set(["CONFIRMED", "COMPLETED"])

/** Estados terminais que alguns donos (ex.: adesão, regularização) ainda não espelham no ledger. */
const OWNER_MAY_LAG: ReadonlySet<ChargeStatus> = new Set(["REFUNDED", "REVIEW"])

/**
 * CONFIRMED e COMPLETED são o mesmo fato (pago); o ledger pode estar um passo à frente da fonte.
 * Tolerância deliberada, de um sentido só: ledger pago com fonte REFUNDED/REVIEW não diverge, porque
 * o espelho de reembolso/disputa só existe para parte dos donos e o cron diário reportaria o mesmo
 * falso positivo todos os dias. O inverso (ledger REFUNDED/REVIEW e fonte paga) continua divergindo.
 */
export function statusesAgree(ledger: ChargeStatus, source: ChargeStatus): boolean {
  if (ledger === source) return true
  if (PAID.has(ledger) && OWNER_MAY_LAG.has(source)) return true
  return PAID.has(ledger) && PAID.has(source)
}

/** Compara os espelhos com a fonte e reporta. Nunca corrige (PAY-LEDGER-T010). */
export class ChargeDivergenceService {
  constructor(private readonly dependencies: ChargeDivergenceDependencies) {}

  async run(input: { windowHours: number; limit: number }): Promise<DivergenceRunResult> {
    const now = (this.dependencies.now ?? (() => new Date()))()
    const since = new Date(now.getTime() - input.windowHours * 3_600_000)
    const mirrors = await this.dependencies.charges.listForDivergence({
      sources: ["ASAAS_SHADOW", "MIRROR"],
      createdAfter: since,
      limit: input.limit,
    })

    const divergences: Divergence[] = []
    for (const charge of mirrors) {
      const found = await this.compare(charge)
      if (found) divergences.push(...found)
    }
    divergences.push(...(await this.findMissingCharges(since, input.limit)))

    if (divergences.length > 0) this.dependencies.report(divergences)
    return { checked: mirrors.length, divergences, truncated: mirrors.length >= input.limit }
  }

  private async compare(charge: PaymentCharge): Promise<Divergence[] | null> {
    const snapshot = await this.dependencies.source.read(charge)
    if (!snapshot) return [{ chargeId: charge.id, kind: "MISSING_SOURCE", ledger: null, source: null }]
    const found: Divergence[] = []
    if (snapshot.amountCents !== null && snapshot.amountCents !== charge.amountCents) {
      found.push({ chargeId: charge.id, kind: "AMOUNT", ledger: charge.amountCents, source: snapshot.amountCents })
    }
    if (snapshot.status && !statusesAgree(charge.status as ChargeStatus, snapshot.status)) {
      found.push({ chargeId: charge.id, kind: "STATUS", ledger: charge.status, source: snapshot.status })
    }
    return found
  }

  private async findMissingCharges(since: Date, limit: number): Promise<Divergence[]> {
    const expected = await this.dependencies.source.listExpectedShadowPayments({ since, limit })
    const missing: Divergence[] = []
    for (const payment of expected) {
      const charge = await this.dependencies.charges.findByExternalIdentity({
        provider: "ASAAS",
        providerEnvironment: this.dependencies.asaasEnvironment(),
        providerContext: payment.account,
        providerExternalId: payment.paymentId,
      })
      if (!charge) {
        missing.push({ chargeId: null, kind: "MISSING_CHARGE", ledger: null, source: `${payment.account}:${payment.paymentId}` })
      }
    }
    return missing
  }
}
