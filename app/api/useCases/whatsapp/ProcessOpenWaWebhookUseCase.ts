import { Output } from "@/lib/output"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { normalizeOpenWaWebhookEvent } from "@/lib/whatsapp/openwa-event-normalize"
import { toQrCodeImageUrl } from "@/app/api/services/whatsapp/qrCodeUtils"
import {
  normalizeRemoteJid,
  resolveNormalizedPhone,
} from "@/app/api/services/whatsapp/phoneUtils"
import { sanitizeDbText, stripHtmlTags } from "@/lib/whatsapp/sanitize-db-text"
import { WebhookPayloadRejectedError } from "@/lib/whatsapp/webhook-processing-errors"
import type { Prisma, WhatsAppMessageStatus } from "@prisma/client"
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

export type ProcessOpenWaWebhookDeps = {
  publish?: PublishWhatsappRadarEvent
}

interface ProcessOpenWaWebhookInput {
  teamId: string
  configId: string
  rawEvent: unknown
}

function ackToStatus(ack: number): WhatsAppMessageStatus | null {
  if (ack >= 3) return "READ"
  if (ack === 2) return "DELIVERED"
  if (ack === 1) return "SENT"
  return null
}

export class ProcessOpenWaWebhookUseCase {
  constructor(
    private readonly repository: IWhatsAppRepository = whatsAppRepository,
    private readonly deps: ProcessOpenWaWebhookDeps = {}
  ) {}

  async execute(input: ProcessOpenWaWebhookInput): Promise<Output> {
    try {
      const event = normalizeOpenWaWebhookEvent(input.rawEvent)
      if (event.kind === "invalid") {
        throw new WebhookPayloadRejectedError(event.reason)
      }

      console.info("[ProcessOpenWaWebhookUseCase][execute] Processing", event.kind)

      switch (event.kind) {
        case "qr":
          await this.repository.updateConfig(input.configId, {
            status: "QR_READY",
            qrCodeText: event.qr,
            qrCodeImageUrl: toQrCodeImageUrl(event.qr),
          })
          break
        case "ready":
          await this.repository.updateConfig(input.configId, {
            status: "CONNECTED",
            qrCodeText: null,
            qrCodeImageUrl: null,
            lastConnectedAt: new Date(),
          })
          break
        case "disconnected":
          await this.repository.updateConfig(input.configId, {
            status: "DISCONNECTED",
            lastDisconnectedAt: new Date(),
            qrCodeText: null,
            qrCodeImageUrl: null,
          })
          break
        case "message":
          await this.handleMessage(input.teamId, input.configId, event)
          break
        case "message_ack":
          await this.handleAck(input.teamId, event.providerMessageId, event.ack)
          break
        default: {
          const _exhaustive: never = event
          return _exhaustive
        }
      }

      return new Output(true, [], [], { processed: true })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao processar webhook OpenWA"
      const retryable = !(error instanceof WebhookPayloadRejectedError)
      console.error("[ProcessOpenWaWebhookUseCase][execute]", message)
      return new Output(false, [], [message], { processed: false, retryable })
    }
  }

  private async handleMessage(
    teamId: string,
    configId: string,
    event: Extract<ReturnType<typeof normalizeOpenWaWebhookEvent>, { kind: "message" }>
  ): Promise<void> {
    const remoteJid = event.remoteJid
    const phoneRaw = normalizeRemoteJid(remoteJid)
    const normalizedPhone = resolveNormalizedPhone(remoteJid, phoneRaw)
    const pushName = event.pushName
      ? stripHtmlTags(sanitizeDbText(event.pushName)) ?? undefined
      : undefined

    const conversation = await this.repository.findOrCreateConversation({
      teamId,
      configId,
      externalChatId: remoteJid,
      contactPhone: phoneRaw,
      normalizedPhone,
      contactName: pushName,
    })

    const existing = await this.repository.findMessageByProviderMessageId(
      teamId,
      event.providerMessageId
    )
    if (existing) return

    const direction = event.fromMe ? "OUTBOUND" : "INBOUND"
    const messageType = event.hasMedia ? "IMAGE" : "TEXT"
    const contentText = sanitizeDbText(event.body)

    const created = await this.repository.createMessage({
      conversation: { connect: { id: conversation.id } },
      team: { connect: { id: teamId } },
      config: { connect: { id: configId } },
      providerMessageId: event.providerMessageId,
      direction,
      messageType,
      status: event.fromMe ? "SENT" : "RECEIVED",
      contentText,
      mediaStatus: event.hasMedia ? "PROCESSING" : undefined,
      mediaMimeType: event.mediaMimeType,
      mediaFileName: event.mediaFileName,
      sentAt: event.timestamp,
      rawPayload: {
        ...event.raw,
        ...(event.mediaBase64 ? { mediaBase64: event.mediaBase64 } : {}),
      } as Prisma.InputJsonValue,
    })

    await this.repository.updateConversation(conversation.id, {
      lastMessageAt: event.timestamp,
      lastMessagePreview: contentText?.slice(0, 120) ?? (event.hasMedia ? "[mídia]" : null),
      ...(event.fromMe
        ? {}
        : { unreadCount: { increment: 1 } }),
    })

    const payload: WhatsappRadarEventPayload = {
      source: "message",
      teamId,
      messageId: created.id,
    }
    const publish = this.deps.publish ?? defaultPublish
    try {
      await publish(payload)
    } catch (error) {
      console.error(
        `[ProcessOpenWaWebhookUseCase][handleMessage] ${WHATSAPP_RADAR_EVENTS_QUEUE_PUBLISH_FAILED_TAG}`,
        error
      )
      const { syncWhatsappMessageToRadarUseCase } = await import(
        "@/app/api/useCases/whatsapp/SyncWhatsappMessageToRadarUseCase"
      )
      await syncWhatsappMessageToRadarUseCase.execute({
        teamId,
        message: created,
        conversation,
      })
    }
  }

  private async handleAck(
    teamId: string,
    providerMessageId: string,
    ack: number
  ): Promise<void> {
    const status = ackToStatus(ack)
    if (!status) return
    const existing = await this.repository.findMessageByProviderMessageId(
      teamId,
      providerMessageId
    )
    if (!existing || existing.direction !== "OUTBOUND") return
    await this.repository.updateMessageStatus(existing.id, { status })
  }
}

export const processOpenWaWebhookUseCase = new ProcessOpenWaWebhookUseCase()
