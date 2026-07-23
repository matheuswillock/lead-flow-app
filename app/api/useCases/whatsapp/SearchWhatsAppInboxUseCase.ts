import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import {
  buildConversationVisibilityWhere,
  buildOperatorContactPhoneFilter,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"

class SearchWhatsAppInboxUseCase {
  async execute(input: { teamId: string; access: TeamAccess; query: string }): Promise<Output> {
    try {
      const [contactWhere, conversationWhere] = await Promise.all([
        buildOperatorContactPhoneFilter(input.access),
        buildConversationVisibilityWhere(input.access),
      ])
      return new Output(
        true,
        [],
        [],
        await whatsAppService.searchInbox(input.teamId, input.query, 20, {
          contactWhere,
          conversationWhere,
        })
      )
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao buscar contatos"], null)
    }
  }
}

export const searchWhatsAppInboxUseCase = new SearchWhatsAppInboxUseCase()
