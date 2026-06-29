import { Output } from "@/lib/output"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { WHATSAPP_HISTORY_SYNC_DAYS } from "@/app/api/services/whatsapp/WhatsAppService"
import { customerDataPlatformService } from "@/app/api/services/cdp/CustomerDataPlatformService"

interface SyncWhatsAppHistoryInput {
  teamId: string
}

class SyncWhatsAppHistoryUseCase {
  async execute(input: SyncWhatsAppHistoryInput): Promise<Output> {
    try {
      const result = await whatsAppService.syncTeamHistory(input.teamId)

      if (result.chats > 0 || result.messages > 0) {
        const since = new Date(Date.now() - WHATSAPP_HISTORY_SYNC_DAYS * 24 * 60 * 60 * 1000)
        try {
          await customerDataPlatformService.syncFromWhatsapp(input.teamId, { since })
        } catch (cdpError) {
          console.error("[SyncWhatsAppHistoryUseCase][execute] CDP backfill failed", cdpError)
        }
      }

      return new Output(
        true,
        [`Histórico sincronizado: ${result.chats} conversas, ${result.messages} mensagens`],
        [],
        result
      )
    } catch (error) {
      console.error("[SyncWhatsAppHistoryUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar histórico do WhatsApp"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsAppHistoryUseCase = new SyncWhatsAppHistoryUseCase()
