import { Output } from "@/lib/output"
import { PaymentProviderMaintenanceService } from "@/app/api/services/PaymentProviderPayment/PaymentProviderMaintenanceService"

const DEFAULT_BATCH_SIZE = 50
const MAX_BATCH_SIZE = 500

export class PaymentProviderMaintenanceUseCase {
  constructor(private readonly service: PaymentProviderMaintenanceService) {}

  async execute(input: { limit?: number } = {}): Promise<Output> {
    try {
      const limit = normalizeLimit(input.limit)
      const result = await this.service.run({ limit })
      return new Output(true, ["Manutenção de pagamentos concluída"], [], result)
    } catch (error) {
      console.error("[PaymentProviderMaintenanceUseCase] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return new Output(false, [], ["Não foi possível concluir a manutenção de pagamentos"], null)
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
