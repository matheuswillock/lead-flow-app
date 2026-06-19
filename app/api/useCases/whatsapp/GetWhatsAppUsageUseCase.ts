import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface GetWhatsAppUsageInput {
  teamId: string
}

class GetWhatsAppUsageUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: GetWhatsAppUsageInput): Promise<Output> {
    try {
      const result = await this.service.getUsageSummary(input.teamId)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[GetWhatsAppUsageUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao buscar resumo de uso do WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const getWhatsAppUsageUseCase = new GetWhatsAppUsageUseCase(whatsAppService)
