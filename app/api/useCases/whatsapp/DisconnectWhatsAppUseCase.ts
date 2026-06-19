import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface DisconnectInput {
  teamId: string
  profileId: string
}

class DisconnectWhatsAppUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: DisconnectInput): Promise<Output> {
    try {
      const result = await this.service.disconnect(input.teamId, input.profileId)
      return new Output(true, ["WhatsApp desconectado com sucesso"], [], result)
    } catch (error) {
      console.error("[DisconnectWhatsAppUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao desconectar WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const disconnectWhatsAppUseCase = new DisconnectWhatsAppUseCase(whatsAppService)
