import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface ArchiveConversationInput {
  conversationId: string
  teamId: string
  archived: boolean
}

class ArchiveConversationUseCase {
  async execute(input: ArchiveConversationInput): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.findConversationByIdForTeam(
        input.conversationId,
        input.teamId
      )
      if (!conversation) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      await whatsAppRepository.updateConversation(input.conversationId, {
        isArchived: input.archived,
      })
      const label = input.archived ? "arquivada" : "desarquivada"
      return new Output(true, [`Conversa ${label} com sucesso`], [], null)
    } catch (error) {
      console.error("[ArchiveConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao arquivar conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const archiveConversationUseCase = new ArchiveConversationUseCase()
