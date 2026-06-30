import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface TakeoverConversationInput {
  teamId: string
  conversationId: string
  profileId: string
  access: TeamAccess
}

class TakeoverConversationUseCase {
  async execute(input: TakeoverConversationInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const updated = await whatsAppRepository.updateConversation(input.conversationId, {
        handoffMode: "HUMAN",
        assignedProfile: { connect: { id: input.profileId } },
      })

      return new Output(true, ["Conversa assumida com sucesso"], [], updated)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[TakeoverConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao assumir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const takeoverConversationUseCase = new TakeoverConversationUseCase()
