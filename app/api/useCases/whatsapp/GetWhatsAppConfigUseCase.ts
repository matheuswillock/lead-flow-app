import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class GetWhatsAppConfigUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(teamId: string): Promise<Output> {
    try {
      const result = await this.service.getConfig(teamId)
      if (!result) {
        return new Output(false, [], ["Configuração não encontrada"], null)
      }
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[GetWhatsAppConfigUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao buscar configuração do WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const getWhatsAppConfigUseCase = new GetWhatsAppConfigUseCase(whatsAppService)
