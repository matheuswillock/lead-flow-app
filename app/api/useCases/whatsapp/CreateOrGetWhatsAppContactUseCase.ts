import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

class CreateOrGetWhatsAppContactUseCase {
  async execute(input: { teamId: string; access: TeamAccess; phone: string; name?: string }): Promise<Output> {
    try {
      const contact = await whatsAppService.createOrGetContact(input)
      return new Output(true, ["Contato disponível"], [], contact)
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao salvar contato"], null)
    }
  }
}

export const createOrGetWhatsAppContactUseCase = new CreateOrGetWhatsAppContactUseCase()
