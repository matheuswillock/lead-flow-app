import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface DeleteConversationInput {
  conversationId: string
}

class DeleteConversationUseCase {
  async execute(input: DeleteConversationInput): Promise<Output> {
    try {
      await whatsAppRepository.deleteConversation(input.conversationId)
      return new Output(true, ["Conversa excluída com sucesso"], [], null)
    } catch (error) {
      console.error("[DeleteConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao excluir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const deleteConversationUseCase = new DeleteConversationUseCase()
