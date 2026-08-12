import { Output } from "@/lib/output"
import { asaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService"
import { asaasNotificationBackfillRepository } from "@/app/api/infra/data/repositories/asaasNotificationBackfill/AsaasNotificationBackfillRepository"
import type { IAsaasNotificationBackfillRepository } from "@/app/api/infra/data/repositories/asaasNotificationBackfill/IAsaasNotificationBackfillRepository"
import type { IAsaasCustomerService } from "@/app/api/services/AsaasCustomer/IAsaasCustomerService"

export type AsaasNotificationBackfillResult = {
  asaasCustomerId: string
  completed: boolean
  updatedCount: number
  error?: string
}

export class AsaasNotificationBackfillUseCase {
  constructor(
    private readonly asaasCustomer: IAsaasCustomerService = asaasCustomerService,
    private readonly stateRepo: IAsaasNotificationBackfillRepository = asaasNotificationBackfillRepository
  ) {}

  async processCustomer(asaasCustomerId: string): Promise<Output> {
    const result = await this.disableCustomerNotifications(asaasCustomerId)
    if (!result.completed) {
      return new Output(false, [], [result.error ?? "Falha no backfill Asaas"], result)
    }
    return new Output(true, ["Notificações Asaas desabilitadas para o cliente"], [], result)
  }

  async processPending(limit = 100): Promise<Output> {
    try {
      const completed = new Set(await this.stateRepo.listCompletedCustomerIds())
      const candidates = await this.stateRepo.listProfileAsaasCustomerIds(Math.max(1, limit) * 3)
      const targets: string[] = []
      for (const customerId of candidates) {
        if (completed.has(customerId)) continue
        targets.push(customerId)
        if (targets.length >= limit) break
      }

      const results = []
      for (const customerId of targets) {
        results.push(await this.disableCustomerNotifications(customerId))
      }

      const failed = results.filter((item) => !item.completed).length
      return new Output(
        failed === 0,
        failed === 0 ? ["Backfill Asaas concluído"] : [],
        failed > 0 ? [`${failed} cliente(s) falharam no backfill`] : [],
        {
          total: results.length,
          completed: results.length - failed,
          failed,
          results,
        }
      )
    } catch (error) {
      console.error("[AsaasNotificationBackfillUseCase][processPending]", error)
      return new Output(false, [], ["Erro ao executar backfill Asaas"], null)
    }
  }

  private async disableCustomerNotifications(
    asaasCustomerId: string
  ): Promise<AsaasNotificationBackfillResult> {
    const id = asaasCustomerId.trim()
    if (!id) {
      return {
        asaasCustomerId,
        completed: false,
        updatedCount: 0,
        error: "asaasCustomerId vazio",
      }
    }

    try {
      const disabled = await this.asaasCustomer.disableCustomerFacingNotifications(id)
      await this.stateRepo.markCompleted(id)
      return {
        asaasCustomerId: id,
        completed: true,
        updatedCount: disabled.updatedCount,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido Asaas"
      console.error("[AsaasNotificationBackfillUseCase][disableCustomerNotifications]", {
        asaasCustomerId: id,
        error,
      })
      await this.stateRepo.markFailed(id, message)
      return {
        asaasCustomerId: id,
        completed: false,
        updatedCount: 0,
        error: message,
      }
    }
  }
}

export const asaasNotificationBackfillUseCase = new AsaasNotificationBackfillUseCase()
