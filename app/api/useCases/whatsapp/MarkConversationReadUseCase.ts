import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class MarkConversationReadUseCase {
  async execute(conversationId: string, access: TeamAccess): Promise<Output> {
    try {
      await assertCanAccessConversation(access, conversationId)

      const conversation = await whatsAppRepository.updateConversation(conversationId, {
        unreadCount: 0,
      })
      return new Output(true, [], [], conversation)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[MarkConversationReadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao marcar conversa como lida"
      return new Output(false, [], [message], null)
    }
  }
}

export const markConversationReadUseCase = new MarkConversationReadUseCase()
