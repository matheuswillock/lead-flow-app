import { Output } from "@/lib/output"
import type { IWhatsAppService, CreateWhatsAppConfigInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class CreateWhatsAppConfigUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: CreateWhatsAppConfigInput): Promise<Output> {
    try {
      const result = await this.service.createConfig(input)
      return new Output(true, ["Configuração criada com sucesso"], [], result)
    } catch (error) {
      console.error("[CreateWhatsAppConfigUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar configuração do WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const createWhatsAppConfigUseCase = new CreateWhatsAppConfigUseCase(whatsAppService)
