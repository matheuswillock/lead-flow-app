import { Output } from "@/lib/output"
import type { WhatsAppConversationSelect, WhatsAppMessageSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { customerDataPlatformService } from "@/app/api/services/cdp/CustomerDataPlatformService"

interface SyncWhatsappMessageToCdpInput {
  teamId: string
  message: WhatsAppMessageSelect
  conversation: WhatsAppConversationSelect
}

class SyncWhatsappMessageToCdpUseCase {
  async execute(input: SyncWhatsappMessageToCdpInput): Promise<Output> {
    try {
      await customerDataPlatformService.syncWhatsappMessageToCdp(input)
      return new Output(true, [], [], { synced: true })
    } catch (error) {
      console.error("[SyncWhatsappMessageToCdpUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar mensagem com CDP"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsappMessageToCdpUseCase = new SyncWhatsappMessageToCdpUseCase()
