import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class MarkConversationReadUseCase {
  async execute(conversationId: string): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.updateConversation(conversationId, {
        unreadCount: 0,
      })
      return new Output(true, [], [], conversation)
    } catch (error) {
      console.error("[MarkConversationReadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao marcar conversa como lida"
      return new Output(false, [], [message], null)
    }
  }
}

export const markConversationReadUseCase = new MarkConversationReadUseCase()
