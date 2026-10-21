import type { IPaymentChargeRepository } from "@/app/api/infra/data/repositories/paymentCharge/IPaymentChargeRepository"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { PaymentProviderPostPaymentService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderPostPaymentService"
import type { FullRefundCapability } from "@/lib/payment-provider/contracts"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"
import type { ChargePurpose } from "@/lib/payments/types"
import type { ChargeLedger } from "./ChargeLedger"
import type { ChargeReversalHandlers } from "./chargeReversalHandlers"

export type RefundChargeInput = {
  readonly chargeId: string
  readonly reason?: string
  readonly actor: string
}

export type RefundChargeResult = { readonly chargeId: string; readonly status: "REFUNDED" }

export type ChargeRefundDependencies = {
  readonly charges: Pick<IPaymentChargeRepository, "findById">
  readonly ledger: Pick<ChargeLedger, "transition">
  readonly attempts: Pick<IPaymentProviderSessionRepository, "findAttemptById">
  readonly refunder: Pick<PaymentProviderPostPaymentService, "refund">
  readonly resolveProvider: (input: {
    provider: PaymentProviderKey
    environment: PaymentProviderEnvironment
  }) => FullRefundCapability
  readonly reversals: ChargeReversalHandlers
}

/**
 * Reembolso por cobrança do ledger (PAY-LEDGER-T011): o dinheiro volta pelo serviço pós-pagamento
 * existente e o efeito de domínio é revertido pelo handler da finalidade. Disputas ficam fora.
 */
export class ChargeRefundService {
  constructor(private readonly dependencies: ChargeRefundDependencies) {}

  async refund(input: RefundChargeInput): Promise<RefundChargeResult> {
    const { charges, ledger, reversals } = this.dependencies
    const charge = await charges.findById(input.chargeId)
    if (!charge) throw new Error("Cobrança não encontrada")

    const reversal = reversals[charge.purpose as ChargePurpose]
    if (!reversal) throw new Error(`Reversão não implementada para a finalidade ${charge.purpose}`)

    if (charge.status !== "REFUNDED") {
      await this.refundAtProvider(charge, input)
      await ledger.transition({
        chargeId: charge.id,
        toStatus: "REFUNDED",
        rawStatus: "REFUNDED",
        actor: input.actor,
      })
    }
    // Idempotente: repetir após falha parcial só reaplica a reversão.
    await reversal.reverse((await charges.findById(charge.id)) ?? charge)
    return { chargeId: charge.id, status: "REFUNDED" }
  }

  private async refundAtProvider(
    charge: NonNullable<Awaited<ReturnType<IPaymentChargeRepository["findById"]>>>,
    input: RefundChargeInput,
  ): Promise<void> {
    if (charge.status !== "CONFIRMED" && charge.status !== "COMPLETED") {
      throw new Error("Somente cobranças confirmadas podem ser reembolsadas")
    }
    if (!charge.providerAttemptId) throw new Error("Cobrança sem tentativa do provider")
    const attempt = await this.dependencies.attempts.findAttemptById(charge.providerAttemptId)
    if (!attempt) throw new Error("Tentativa do provider não encontrada")
    // Decisão 17: disputa é resolvida fora do sistema; nunca inicia reembolso.
    if (attempt.status === "DISPUTED") throw new Error("Cobrança em disputa não pode ser reembolsada")

    await this.dependencies.refunder.refund({
      attempt,
      provider: this.dependencies.resolveProvider({
        provider: attempt.provider,
        environment: attempt.environment,
      }),
      reason: input.reason,
    })
  }
}
