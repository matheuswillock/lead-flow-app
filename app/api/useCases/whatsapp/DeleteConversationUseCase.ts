import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface DeleteConversationInput {
  conversationId: string
  teamId: string
}

class DeleteConversationUseCase {
  async execute(input: DeleteConversationInput): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.findConversationByIdForTeam(
        input.conversationId,
        input.teamId
      )
      if (!conversation) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

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
