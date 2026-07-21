import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppConversationTagRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppConversationTagRepository"

interface SetConversationTagsInput {
  teamId: string
  conversationId: string
  tagIds: string[]
  access: TeamAccess
}

class SetConversationTagsUseCase {
  async execute(input: SetConversationTagsInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const uniqueTagIds = [...new Set(input.tagIds)]
      if (uniqueTagIds.length > 0) {
        const validCount = await whatsAppConversationTagRepository.countTagsForTeam(
          input.teamId,
          uniqueTagIds
        )
        if (validCount !== uniqueTagIds.length) {
          return new Output(false, [], ["Uma ou mais tags não pertencem a este time"], null)
        }
      }

      const tags = await whatsAppConversationTagRepository.replaceConversationTags(
        input.conversationId,
        uniqueTagIds
      )

      return new Output(true, ["Tags da conversa atualizadas"], [], { tags })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[SetConversationTagsUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar tags da conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const setConversationTagsUseCase = new SetConversationTagsUseCase()
