import { Output } from "@/lib/output"
import type { IWhatsAppService } from "@/app/api/services/whatsapp/IWhatsAppService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

interface SyncWhatsAppGroupParticipantsInput {
  teamId: string
  conversationId: string
}

class SyncWhatsAppGroupParticipantsUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SyncWhatsAppGroupParticipantsInput): Promise<Output> {
    try {
      const result = await this.service.syncGroupParticipants(input.teamId, input.conversationId)
      return new Output(
        true,
        [`${result.imported} participante(s) sincronizado(s)`],
        [],
        result
      )
    } catch (error) {
      console.error("[SyncWhatsAppGroupParticipantsUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao sincronizar participantes do grupo"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsAppGroupParticipantsUseCase = new SyncWhatsAppGroupParticipantsUseCase(
  whatsAppService
)
