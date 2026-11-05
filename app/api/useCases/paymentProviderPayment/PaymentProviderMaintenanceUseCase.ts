import { Output } from "@/lib/output"
import type {
  PaymentProviderMaintenanceResult,
  PaymentProviderMaintenanceService,
} from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"

const DEFAULT_BATCH_SIZE = 50
const MAX_BATCH_SIZE = 500

// Contadores de falha parcial: o lote termina "com sucesso", mas algo ficou sem efeito.
const FAILURE_COUNTERS = [
  "entitlementFailures",
  "purchaseActivationFailures",
  "ownerSettlementFailures",
] as const satisfies readonly (keyof PaymentProviderMaintenanceResult)[]

export class PaymentProviderMaintenanceUseCase {
  constructor(private readonly service: Pick<PaymentProviderMaintenanceService, "run">) {}

  async execute(input: { limit?: number } = {}): Promise<Output> {
    try {
      const limit = normalizeLimit(input.limit)
      const result = await this.service.run({ limit })
      const failures = describeFailures(result)
      // Output inválido faz o withCronAudit disparar o alerta do Slack e a rota responder 500.
      if (failures.length > 0) {
        return new Output(
          false,
          [],
          [`Manutenção de pagamentos concluída com falhas parciais: ${failures.join(", ")}`],
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
}

function describeFailures(result: PaymentProviderMaintenanceResult): string[] {
  return FAILURE_COUNTERS.filter((counter) => result[counter] > 0).map(
    (counter) => `${counter}=${result[counter]}`,
  )
}

function normalizeLimit(limit: number | undefined): number {
  const normalized = limit ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > MAX_BATCH_SIZE) {
    throw new Error("Limite de manutenção inválido")
  }
  return normalized
}
