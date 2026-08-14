import { Output } from "@/lib/output"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { syncWhatsappMessageToRadarUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsappMessageToRadarUseCase"
import { syncWhatsAppHistoryUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsAppHistoryUseCase"
import type { WhatsappRadarEventPayload } from "@/lib/queues/whatsapp-radar-events"

export type ProcessWhatsappRadarEventDeps = {
  repository: Pick<IWhatsAppRepository, "findMessageByIdForTeam" | "findConversationById">
  syncMessage: Pick<typeof syncWhatsappMessageToRadarUseCase, "execute">
  syncHistory: Pick<typeof syncWhatsAppHistoryUseCase, "syncRadarFromHistory">
}

const defaultDeps: ProcessWhatsappRadarEventDeps = {
  repository: whatsAppRepository,
  syncMessage: syncWhatsappMessageToRadarUseCase,
  syncHistory: syncWhatsAppHistoryUseCase,
}

export class ProcessWhatsappRadarEventUseCase {
  constructor(private readonly deps: ProcessWhatsappRadarEventDeps = defaultDeps) {}

  async execute(payload: WhatsappRadarEventPayload): Promise<Output> {
    if (payload.source === "message") {
      const message = await this.deps.repository.findMessageByIdForTeam(
        payload.teamId,
        payload.messageId
      )
      if (!message) {
        return new Output(true, ["Mensagem não encontrada"], [], { skipped: true })
      }
      const conversation = await this.deps.repository.findConversationById(message.conversationId)
      if (!conversation) {
        return new Output(true, ["Conversa não encontrada"], [], { skipped: true })
      }
      return this.deps.syncMessage.execute({
        teamId: payload.teamId,
        message,
        conversation,
      })
    }

    return this.deps.syncHistory.syncRadarFromHistory({
      teamId: payload.teamId,
      since: payload.since,
    })
  }
}

export const processWhatsappRadarEventUseCase = new ProcessWhatsappRadarEventUseCase()
