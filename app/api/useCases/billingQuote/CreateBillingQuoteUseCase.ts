import type { IBillingQuoteRepository } from "@/app/api/infra/data/repositories/billingQuote/IBillingQuoteRepository"
import type { IAsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/IAsaasSubscriptionService"
import type { IBillingQuoteService } from "@/app/api/services/billingQuote/IBillingQuoteService"
import { Output } from "@/lib/output"

export class CreateBillingQuoteUseCase {
  constructor(
    private readonly dependencies: {
      repository: IBillingQuoteRepository
      asaasSubscriptionService: IAsaasSubscriptionService
      quoteService: IBillingQuoteService
    }
  ) {}

  async executeForAuthenticatedSupabaseId(supabaseId: string): Promise<Output> {
    const access = await this.dependencies.repository.getAccessBySupabaseId(supabaseId)
    if (!access) {
      return new Output(false, [], ["Conta de cobrança não encontrada"], null)
    }
    if (!access.isMaster) {
      return new Output(false, [], ["Apenas o master pode visualizar a projeção de cobrança"], null)
    }
    if (access.isBanned) {
      return new Output(false, [], ["Esta conta está bloqueada"], null)
    }

    return this.execute(access.billingOwnerId)
  }

  async execute(billingOwnerId: string): Promise<Output> {
    try {
      const projection = await this.dependencies.repository.getProjection(billingOwnerId)
      if (!projection) {
        return new Output(false, [], ["Conta de cobrança não encontrada"], null)
      }

      let currentAsaasAmount: number | null = null
      const externalBlockingReasons: string[] = []
      if (projection.asaasSubscriptionId && projection.asaasSubscriptionAccount) {
        try {
          const subscription = await this.dependencies.asaasSubscriptionService.getSubscription(
            projection.asaasSubscriptionId,
            projection.asaasSubscriptionAccount
          )
          currentAsaasAmount = Number(subscription.value)
        } catch {
          externalBlockingReasons.push("Ponteiro de assinatura Asaas órfão")
        }
      } else {
        externalBlockingReasons.push("Ponteiro de assinatura Asaas ausente")
      }

      const { asaasSubscriptionId: _subscriptionId, asaasSubscriptionAccount: _account, ...input } = projection
      const quote = this.dependencies.quoteService.createQuote({
        ...input,
        currentAsaasAmount,
        externalBlockingReasons,
      })
      return new Output(true, ["Projeção de cobrança calculada"], [], quote)
    } catch (error) {
      console.error("[CreateBillingQuoteUseCase] Falha ao calcular projeção:", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Falha ao calcular projeção de cobrança"],
        null
      )
    }
  }
}
