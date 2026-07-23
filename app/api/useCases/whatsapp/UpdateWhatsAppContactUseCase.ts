import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class UpdateWhatsAppContactUseCase {
  async execute(input: { teamId: string; access: TeamAccess; contactId: string; phone?: string; name?: string | null }): Promise<Output> {
    try {
      const contact = await whatsAppService.updateContact(input)
      return new Output(true, ["Contato atualizado"], [], contact)
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao atualizar contato"], null)
    }
  }
}

export const updateWhatsAppContactUseCase = new UpdateWhatsAppContactUseCase()
