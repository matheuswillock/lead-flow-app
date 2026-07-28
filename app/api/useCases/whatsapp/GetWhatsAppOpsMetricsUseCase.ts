import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

export type WhatsAppOpsMetrics = {
  deadLetterCount: number
  pendingWebhookCount: number
  unknownOutboundCount: number
  failedMediaCount: number
  pendingActionCommandCount: number
  unknownActionCommandCount: number
  requeueHint: string
}

class GetWhatsAppOpsMetricsUseCase {
  async execute(input: { teamId: string }): Promise<Output> {
    try {
      const metrics = await whatsAppRepository.getTeamOpsMetrics(input.teamId)
      const result: WhatsAppOpsMetrics = {
        ...metrics,
        requeueHint:
          "Eventos em dead-letter podem ser reenfileirados por um gestor via POST /webhook-events/:eventId/requeue.",
      }
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[GetWhatsAppOpsMetricsUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível carregar as métricas operacionais."], null)
    }
  }
}

export const getWhatsAppOpsMetricsUseCase = new GetWhatsAppOpsMetricsUseCase()
