import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface UpdateConversationContactNameInput {
  conversationId: string
  teamId: string
  contactName: string
  access: TeamAccess
}

class UpdateConversationContactNameUseCase {
  async execute(input: UpdateConversationContactNameInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const trimmed = input.contactName.trim()
      if (!trimmed) {
        return new Output(false, [], ["Nome do contato é obrigatório"], null)
      }

      const updatedConversation = await whatsAppRepository.updateConversation(input.conversationId, {
        contactName: trimmed,
        contactNameSource: "MANUAL",
      })

      return new Output(true, ["Nome do contato atualizado"], [], updatedConversation)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[UpdateConversationContactNameUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar nome do contato"
      return new Output(false, [], [message], null)
    }
  }
}

export const updateConversationContactNameUseCase = new UpdateConversationContactNameUseCase()
