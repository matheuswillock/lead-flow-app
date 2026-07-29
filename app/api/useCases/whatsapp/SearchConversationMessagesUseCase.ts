import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { whatsappError } from "@/lib/whatsapp/api-error"

type SearchConversationMessagesInput = {
  teamId: string
  conversationId: string
  q: string
  page?: number
  limit?: number
  access: TeamAccess
}

class SearchConversationMessagesUseCase {
  async execute(input: SearchConversationMessagesInput): Promise<Output> {
    try {
      const query = input.q.trim()
      if (!query) {
        return new Output(false, [], ["Informe o termo de busca."], whatsappError("VALIDATION_ERROR"))
      }

      await assertCanAccessConversation(input.access, input.conversationId)

      const page = Math.max(1, input.page ?? 1)
      const limit = Math.min(Math.max(1, input.limit ?? 20), 100)

      const result = await whatsAppRepository.searchMessagesInConversation({
        teamId: input.teamId,
        conversationId: input.conversationId,
        profileId: input.access.profileId,
        query,
        page,
        limit,
      })

      return new Output(true, [], [], { ...result, page, limit })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[SearchConversationMessagesUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível buscar mensagens."], whatsappError("INTERNAL_ERROR"))
    }
  }
}

export const searchConversationMessagesUseCase = new SearchConversationMessagesUseCase()
