import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface GetMessagesInput {
  conversationId: string
  teamId: string
  access: TeamAccess
  page?: number
  limit?: number
}

class GetMessagesUseCase {
  async execute(input: GetMessagesInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const result = await whatsAppRepository.listMessages({
        conversationId: input.conversationId,
        profileId: input.access.profileId,
        page: input.page,
        limit: input.limit,
      })
      return new Output(true, [], [], result)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[GetMessagesUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao buscar mensagens"
      return new Output(false, [], [message], null)
    }
  }
}

export const getMessagesUseCase = new GetMessagesUseCase()
