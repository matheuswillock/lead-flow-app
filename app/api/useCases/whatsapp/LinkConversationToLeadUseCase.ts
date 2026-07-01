import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface LinkConversationToLeadInput {
  conversationId: string
  leadId: string
  access: TeamAccess
}

class LinkConversationToLeadUseCase {
  async execute(input: LinkConversationToLeadInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const conversation = await whatsAppRepository.linkConversationToLead(
        input.conversationId,
        input.leadId
      )
      return new Output(true, ["Conversa vinculada ao lead com sucesso"], [], conversation)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[LinkConversationToLeadUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao vincular conversa ao lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const linkConversationToLeadUseCase = new LinkConversationToLeadUseCase()
