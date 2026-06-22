import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface ReconnectInput {
  teamId: string
  profileId: string
}

class ReconnectWhatsAppUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: ReconnectInput): Promise<Output> {
    try {
      const result = await this.service.reconnect(input.teamId, input.profileId)
      return new Output(true, ["Reconexão iniciada com sucesso"], [], result)
    } catch (error) {
      console.error("[ReconnectWhatsAppUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao reconectar WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const reconnectWhatsAppUseCase = new ReconnectWhatsAppUseCase(whatsAppService)
