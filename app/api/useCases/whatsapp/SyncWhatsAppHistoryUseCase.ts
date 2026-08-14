import { Output } from "@/lib/output"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { WHATSAPP_HISTORY_SYNC_DAYS } from "@/app/api/services/whatsapp/WhatsAppService"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { WhatsappRadarEventPayload } from "@/lib/queues/whatsapp-radar-events"

const WHATSAPP_RADAR_EVENTS_QUEUE_PUBLISH_FAILED_TAG =
  "whatsapp_radar_events_queue_publish_failed"

type PublishWhatsappRadarEvent = (
  payload: WhatsappRadarEventPayload
) => Promise<{ messageId: string | null }>

async function defaultPublish(
  payload: WhatsappRadarEventPayload
): Promise<{ messageId: string | null }> {
  const { publishWhatsappRadarEvent } = await import("@/lib/queues/whatsapp-radar-events")
  return publishWhatsappRadarEvent(payload)
}

export type SyncWhatsAppHistoryDeps = {
  publish?: PublishWhatsappRadarEvent
  syncTeamHistory?: typeof whatsAppService.syncTeamHistory
  syncFromWhatsapp?: typeof radarService.syncFromWhatsapp
}

interface SyncWhatsAppHistoryInput {
  teamId: string
}

export class SyncWhatsAppHistoryUseCase {
  constructor(private readonly deps: SyncWhatsAppHistoryDeps = {}) {}

  async execute(input: SyncWhatsAppHistoryInput): Promise<Output> {
    try {
      const syncTeamHistory = this.deps.syncTeamHistory ?? whatsAppService.syncTeamHistory.bind(whatsAppService)
      const result = await syncTeamHistory(input.teamId)

      if (result.chats > 0 || result.messages > 0) {
        const since = new Date(Date.now() - WHATSAPP_HISTORY_SYNC_DAYS * 24 * 60 * 60 * 1000)
        const payload: WhatsappRadarEventPayload = {
          source: "history",
          teamId: input.teamId,
          since: since.toISOString(),
        }
        const publish = this.deps.publish ?? defaultPublish
        try {
          await publish(payload)
        } catch (error) {
          console.error(
            `[SyncWhatsAppHistoryUseCase][execute] ${WHATSAPP_RADAR_EVENTS_QUEUE_PUBLISH_FAILED_TAG}`,
            error
          )
          await this.syncRadarFromHistory({ teamId: input.teamId, since: payload.since })
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

  async syncRadarFromHistory(input: { teamId: string; since: string }): Promise<Output> {
    try {
      const since = new Date(input.since)
      if (Number.isNaN(since.getTime())) {
        return new Output(false, [], ["since inválido"], null)
      }
      const syncFromWhatsapp =
        this.deps.syncFromWhatsapp ?? radarService.syncFromWhatsapp.bind(radarService)
      const result = await syncFromWhatsapp(input.teamId, { since })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncWhatsAppHistoryUseCase][syncRadarFromHistory]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar histórico WhatsApp no Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncWhatsAppHistoryUseCase = new SyncWhatsAppHistoryUseCase()
