import { Output } from "@/lib/output"
import type { CreateConversationInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class CreateConversationUseCase {
  async execute(input: CreateConversationInput): Promise<Output> {
    try {
      const conversation = await whatsAppService.createConversation(input)
      return new Output(true, ["Conversa criada com sucesso"], [], conversation)
    } catch (error) {
      console.error("[CreateConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao criar conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const createConversationUseCase = new CreateConversationUseCase()
