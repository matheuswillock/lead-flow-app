import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface SyncWhatsAppContactsInput {
  teamId: string
  conversationId?: string
}

class SyncWhatsAppContactsUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SyncWhatsAppContactsInput): Promise<Output> {
    try {
      const result = await this.service.syncContacts(input.teamId, input.conversationId)
      const message =
        result.imported > 0
          ? `${result.imported} contato(s) importado(s), ${result.updatedConversations} conversa(s) atualizada(s)`
          : `${result.updatedConversations} conversa(s) atualizada(s)`
      return new Output(true, [message], [], result)
    } catch (error) {
      console.error("[SyncWhatsAppContactsUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar contatos"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsAppContactsUseCase = new SyncWhatsAppContactsUseCase(whatsAppService)
