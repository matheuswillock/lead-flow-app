import { Output } from "@/lib/output"
import type { IWhatsAppService, SendMessageInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class SendMessageUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SendMessageInput): Promise<Output> {
    try {
      const result = await this.service.sendMessage(input)
      return new Output(true, ["Mensagem enviada com sucesso"], [], result)
    } catch (error) {
      console.error("[SendMessageUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
      return new Output(false, [], [message], null)
    }
  }
}

export const sendMessageUseCase = new SendMessageUseCase(whatsAppService)
