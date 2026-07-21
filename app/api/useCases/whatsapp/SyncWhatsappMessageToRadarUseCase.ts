import { Output } from "@/lib/output"
import type { WhatsAppConversationSelect, WhatsAppMessageSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { radarService } from "@/app/api/services/radar/RadarService"

interface SyncWhatsappMessageToRadarInput {
  teamId: string
  message: WhatsAppMessageSelect
  conversation: WhatsAppConversationSelect
}

class SyncWhatsappMessageToRadarUseCase {
  async execute(input: SyncWhatsappMessageToRadarInput): Promise<Output> {
    try {
      await radarService.syncWhatsappMessageToRadar(input)
      return new Output(true, [], [], { synced: true })
    } catch (error) {
      console.error("[SyncWhatsappMessageToRadarUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar mensagem com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsappMessageToRadarUseCase = new SyncWhatsappMessageToRadarUseCase()
