import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface ListWhatsAppContactsInput {
  teamId: string
  q?: string
  groupJid?: string
}

class ListWhatsAppContactsUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: ListWhatsAppContactsInput): Promise<Output> {
    try {
      const contacts = await this.service.listContacts(input.teamId, {
        q: input.q,
        groupJid: input.groupJid,
      })
      return new Output(true, [], [], { contacts })
    } catch (error) {
      console.error("[ListWhatsAppContactsUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao listar contatos"
      return new Output(false, [], [message], null)
    }
  }
}

export const listWhatsAppContactsUseCase = new ListWhatsAppContactsUseCase(whatsAppService)
