import { Output } from "@/lib/output"
import type {
  HealthCheckSweepSummary,
  IPaymentProviderHealthCheckService,
} from "@/app/api/services/PaymentProviderConfig/IPaymentProviderHealthCheckService"

/**
 * Varredura periódica de saúde. Duas falhas seguidas degradam a instância; a degradação vira
 * Output inválido para o `withCronAudit` alertar no Slack (sem dados sensíveis na mensagem).
 */
export class PaymentProviderHealthSweepUseCase {
  constructor(private readonly service: Pick<IPaymentProviderHealthCheckService, "checkAll">) {}

  async execute(): Promise<Output> {
    let summary: HealthCheckSweepSummary
    try {
      summary = await this.service.checkAll()
    } catch (error) {
      console.error("[PaymentProviderHealthSweepUseCase]", error instanceof Error ? error.name : "unknown")
      return new Output(false, [], ["Falha ao executar o health-check dos providers"], null)
    }
    if (summary.degraded.length > 0) {
      const names = summary.degraded
        .map((item) => `${item.displayName} (${item.provider}/${item.environment}: ${item.errorCode ?? "erro"})`)
        .join("; ")
      return new Output(false, [], [`Provider(s) degradado(s) após falhas seguidas: ${names}`], summary)
    }
    return new Output(true, ["Health-check dos providers concluído"], [], summary)
  }
}
