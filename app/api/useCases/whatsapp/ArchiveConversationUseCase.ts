import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface ArchiveConversationInput {
  conversationId: string
  teamId: string
  archived: boolean
  access: TeamAccess
}

class ArchiveConversationUseCase {
  async execute(input: ArchiveConversationInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      await whatsAppRepository.updateConversation(input.conversationId, {
        isArchived: input.archived,
      })
      await whatsAppRepository.createAuditEvent({
        teamId: input.teamId,
        conversationId: input.conversationId,
        actorProfileId: input.access.profileId,
        action: input.archived ? "conversation.archive" : "conversation.unarchive",
      })
      const label = input.archived ? "arquivada" : "desarquivada"
      return new Output(true, [`Conversa ${label} com sucesso`], [], null)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[ArchiveConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao arquivar conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const archiveConversationUseCase = new ArchiveConversationUseCase()
