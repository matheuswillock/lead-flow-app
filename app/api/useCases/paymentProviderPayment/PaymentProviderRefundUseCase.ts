import { Output } from "@/lib/output"
import type { FullRefundCapability } from "@/lib/payment-provider/contracts"
import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { OwnerChargeMirror } from "@/app/api/services/paymentCharge/OwnerChargeMirror"
import { PaymentProviderPostPaymentService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderPostPaymentService"

export type PaymentProviderRefundUseCaseDependencies = {
  readonly sessions: Pick<IPaymentProviderSessionRepository, "findAttemptById">
  readonly refundService: PaymentProviderPostPaymentService
  readonly resolveProvider: (environment: "DEV" | "PRODUCTION") => FullRefundCapability
  /** Espelho do ledger: observabilidade, nunca altera o resultado do reembolso. */
  readonly ledgerMirror?: Pick<OwnerChargeMirror, "mirrorStatus">
}

export class PaymentProviderRefundUseCase {
  constructor(private readonly dependencies: PaymentProviderRefundUseCaseDependencies) {}

  async execute(input: { attemptId: string; reason?: string }): Promise<Output> {
    try {
      if (!input.attemptId.trim()) return new Output(false, [], ["attemptId é obrigatório"], null)
      const attempt = await this.dependencies.sessions.findAttemptById(input.attemptId)
      if (!attempt) return new Output(false, [], ["Tentativa não encontrada"], null)
      if (attempt.provider !== "ABACATE_PAY" || attempt.ownerType !== "PLATFORM_PURCHASE") {
        return new Output(false, [], ["Provider não suportado para refund"], null)
      }
      if (attempt.status === "DISPUTED") {
        return new Output(false, [], ["Pagamento em disputa não pode ser reembolsado automaticamente"], null)
      }
      const refunded = await this.dependencies.refundService.refund({
        attempt,
        provider: this.dependencies.resolveProvider(attempt.environment),
        reason: input.reason,
      })
      await this.mirrorRefund(attempt)
      return new Output(true, ["Refund solicitado com sucesso"], [], refunded)
    } catch (error) {
      console.error("[PaymentProviderRefundUseCase] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return new Output(false, [], ["Não foi possível concluir o refund"], null)
    }
  }

  private async mirrorRefund(attempt: { ownerType: string; ownerId: string; externalId?: string | null }) {
    if (!attempt.externalId) return
    try {
      await this.dependencies.ledgerMirror?.mirrorStatus({
        ownerType: attempt.ownerType,
        ownerId: attempt.ownerId,
        externalId: attempt.externalId,
        status: "REFUNDED",
      })
    } catch (error) {
      console.error("[PaymentProviderRefundUseCase][ledger-mirror] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
    }
  }
}
