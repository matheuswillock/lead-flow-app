import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class SearchWhatsAppInboxUseCase {
  async execute(input: { teamId: string; access: TeamAccess; query: string }): Promise<Output> {
    try {
      const contacts = await whatsAppService.searchContacts(input.teamId, input.query)
      return new Output(true, [], [], { contacts })
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao buscar contatos"], null)
    }
  }
}

export const searchWhatsAppInboxUseCase = new SearchWhatsAppInboxUseCase()
