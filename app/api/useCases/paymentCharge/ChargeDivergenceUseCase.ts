import { Output } from "@/lib/output"
import type { ChargeDivergenceService } from "@/app/api/services/paymentCharge/ChargeDivergenceService"

const DEFAULT_WINDOW_HOURS = 48
const DEFAULT_LIMIT = 500

export class ChargeDivergenceUseCase {
  constructor(private readonly service: Pick<ChargeDivergenceService, "run">) {}

  async execute(): Promise<Output> {
    try {
      const result = await this.service.run({ windowHours: DEFAULT_WINDOW_HOURS, limit: DEFAULT_LIMIT })
      return new Output(true, ["Verificação de divergência do ledger concluída"], [], {
        checked: result.checked,
        divergenceCount: result.divergences.length,
        truncated: result.truncated,
      })
    } catch (error) {
      console.error("[ChargeDivergenceUseCase] Error", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return new Output(false, [], ["Não foi possível verificar divergências do ledger"], null)
    }
  }
}
