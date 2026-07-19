import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface DeleteConversationInput {
  conversationId: string
  teamId: string
  access: TeamAccess
}

class DeleteConversationUseCase {
  async execute(input: DeleteConversationInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      console.info("[DeleteConversationUseCase][execute]", {
        teamId: input.teamId,
        conversationId: input.conversationId,
        normalizedPhone: conversation.normalizedPhone,
        profileId: input.access.profileId,
      })

      await whatsAppRepository.softDeleteConversation(input.conversationId)
      await whatsAppRepository.createAuditEvent({
        teamId: input.teamId,
        conversationId: input.conversationId,
        actorProfileId: input.access.profileId,
        action: "conversation.delete",
        metadata: {
          normalizedPhone: conversation.normalizedPhone,
          wasArchived: conversation.isArchived,
        },
      })
      return new Output(true, ["Conversa excluída com sucesso"], [], null)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[DeleteConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao excluir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const deleteConversationUseCase = new DeleteConversationUseCase()
