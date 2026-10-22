import { Output } from "@/lib/output"
import {
  PaymentProviderMaintenanceService,
  type PaymentProviderMaintenanceResult,
} from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"
import { paymentProviderEventInboxRepository } from "@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository"
import { PaymentProviderInboxMonitor } from "@/app/api/useCases/paymentProviderAlert/PaymentProviderInboxMonitor"

const DEFAULT_BATCH_SIZE = 50
const MAX_BATCH_SIZE = 500

const FAILURE_COUNTERS = [
  "entitlementFailures",
  "ownerSettlementFailures",
  "purchaseActivationFailures",
] as const satisfies readonly (keyof PaymentProviderMaintenanceResult)[]

export type InboxHealthCheck = { check(): Promise<unknown> }

export class PaymentProviderMaintenanceUseCase {
  constructor(
    private readonly service: PaymentProviderMaintenanceService,
    private readonly inboxMonitor: InboxHealthCheck = new PaymentProviderInboxMonitor({
      inbox: paymentProviderEventInboxRepository,
    }),
  ) {}

  async execute(input: { limit?: number } = {}): Promise<Output> {
    try {
      const limit = normalizeLimit(input.limit)
      const result = await this.service.run({ limit })
      await this.checkInboxHealthBestEffort()
      const failing = FAILURE_COUNTERS.filter((counter) => result[counter] > 0)
      // Falha parcial invalida o Output: o withCronAudit marca a execução como falha e avisa o Slack.
      if (failing.length > 0) {
        return new Output(
          false,
          [],
          [`Manutenção de pagamentos com falhas parciais: ${failing.map((counter) => `${counter}=${result[counter]}`).join(", ")}`],
          result,
        )
      }
      return new Output(true, ["Manutenção de pagamentos concluída"], [], result)
    } catch (error) {
      console.error("[PaymentProviderMaintenanceUseCase] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return new Output(false, [], ["Não foi possível concluir a manutenção de pagamentos"], null)
    }
  }

  private async checkInboxHealthBestEffort(): Promise<void> {
    try {
      await this.inboxMonitor.check()
    } catch (error) {
      console.error("[PaymentProviderMaintenanceUseCase][inbox-health] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
    }
  }
}

function normalizeLimit(limit: number | undefined): number {
  const normalized = limit ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > MAX_BATCH_SIZE) {
    throw new Error("Limite de manutenção inválido")
  }
  return normalized
}
