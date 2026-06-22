import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface ArchiveConversationInput {
  conversationId: string
  archived: boolean
}

class ArchiveConversationUseCase {
  async execute(input: ArchiveConversationInput): Promise<Output> {
    try {
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
