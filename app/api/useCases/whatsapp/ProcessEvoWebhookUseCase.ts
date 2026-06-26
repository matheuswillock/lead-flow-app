import { Output } from "@/lib/output"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { normalizePhone, buildPeriodKey, normalizeRemoteJid, resolveNormalizedPhone, isGroupChat } from "@/app/api/services/whatsapp/phoneUtils"
import {
  buildMessagePreview,
  normalizeMessageStatus,
  normalizeMessagesUpsertItems,
  parseEvoMessageContent,
} from "@/app/api/services/whatsapp/evo/parseEvoMessageContent"
import { toQrCodeImageUrl } from "@/app/api/services/whatsapp/qrCodeUtils"
import { syncWhatsAppHistoryUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsAppHistoryUseCase"
import { syncWhatsappMessageToCdpUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsappMessageToCdpUseCase"
import { processWhatsAppInboundAutoResponseUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppInboundAutoResponseUseCase"
import type { Prisma, WhatsAppConnectionStatus, WhatsAppMessageStatus } from "@prisma/client"

const MESSAGE_STATUS_RANK: Record<string, number> = {
  FAILED: 0,
  PENDING: 1,
  RECEIVED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
}

function shouldApplyMessageStatus(current: string, next: string): boolean {
  const currentRank = MESSAGE_STATUS_RANK[current] ?? 0
  const nextRank = MESSAGE_STATUS_RANK[next] ?? 0
  return nextRank >= currentRank
}

interface ProcessEvoWebhookInput {
  teamId: string
  configId: string
  rawEvent: unknown
}

function toEvoEvent(raw: unknown): Record<string, unknown> {
  if (typeof raw === "object" && raw !== null) {
    return raw as Record<string, unknown>
  }
  return {}
}

function extractEventType(event: Record<string, unknown>): string {
  const t = event["event"] ?? event["type"]
  return typeof t === "string" ? t.toUpperCase() : ""
}

function extractEventData(event: Record<string, unknown>): unknown {
  return event["data"] ?? {}
}

function extractNestedString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  let current: unknown = obj
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current : undefined
}

function asRecordArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
  }
  if (typeof data === "object" && data !== null) {
    return [data as Record<string, unknown>]
  }
  return []
}

class ProcessEvoWebhookUseCase {
  constructor(private readonly repository: IWhatsAppRepository) {}

  async execute(input: ProcessEvoWebhookInput): Promise<Output> {
    try {
      const event = toEvoEvent(input.rawEvent)
      const eventType = extractEventType(event)
      const data = extractEventData(event)

      console.info("[ProcessEvoWebhookUseCase][execute] Processing event", eventType)

      if (eventType === "MESSAGES_UPSERT" || eventType === "MESSAGES.UPSERT") {
        await this.handleMessagesUpsert(input.teamId, input.configId, data)
      } else if (eventType === "MESSAGES_UPDATE" || eventType === "MESSAGES.UPDATE") {
        await this.handleMessagesUpdate(input.teamId, data)
      } else if (eventType === "CONNECTION_UPDATE" || eventType === "CONNECTION.UPDATE") {
        await this.handleConnectionUpdate(input.configId, data)
      } else if (eventType === "QRCODE_UPDATED" || eventType === "QRCODE.UPDATED") {
        await this.handleQrCodeUpdated(input.configId, data)
      } else if (eventType === "SEND_MESSAGE" || eventType === "SEND.MESSAGE") {
        await this.handleSendMessage(input.teamId, data)
      } else {
        console.info("[ProcessEvoWebhookUseCase][execute] Unhandled event type:", eventType)
      }

      return new Output(true, [], [], { processed: true })
    } catch (error) {
      console.error("[ProcessEvoWebhookUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao processar webhook Evolution"
      return new Output(false, [], [message], null)
    }
  }

  private async handleMessagesUpsert(
    teamId: string,
    configId: string,
    data: unknown
  ): Promise<void> {
    const items = Array.isArray(data)
      ? normalizeMessagesUpsertItems(data)
      : typeof data === "object" && data !== null
        ? normalizeMessagesUpsertItems(data as Record<string, unknown>)
        : []

    for (const item of items) {
      await this.processMessagesUpsertItem(teamId, configId, item)
    }
  }

  private async processMessagesUpsertItem(
    teamId: string,
    configId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const keyObj = (data["key"] as Record<string, unknown> | undefined) ?? {}
    const remoteJid = extractNestedString({ key: keyObj }, "key", "remoteJid") ?? ""
    const providerMessageId = extractNestedString({ key: keyObj }, "key", "id") ?? ""
    const fromMe = (keyObj["fromMe"] as boolean | undefined) ?? false
    const pushName = typeof data["pushName"] === "string" ? data["pushName"] : undefined

    if (!remoteJid || !providerMessageId) {
      console.info("[ProcessEvoWebhookUseCase][handleMessagesUpsert] Missing remoteJid or id, skipping")
      return
    }

    const phoneRaw = normalizeRemoteJid(remoteJid)
    const normalizedPhone = resolveNormalizedPhone(remoteJid, phoneRaw)
    const isGroup = isGroupChat(remoteJid)

    const conversation = await this.repository.findOrCreateConversation({
      teamId,
      configId,
      externalChatId: remoteJid,
      contactPhone: phoneRaw,
      normalizedPhone,
      contactName: isGroup ? undefined : pushName,
    })

    const existing = await this.repository.findMessageByProviderMessageId(teamId, providerMessageId)
    if (existing) {
      console.info("[ProcessEvoWebhookUseCase][handleMessagesUpsert] Message already exists, skipping", providerMessageId)
      return
    }

    const direction = fromMe ? "OUTBOUND" : "INBOUND"
    const now = new Date()
    const periodKey = buildPeriodKey(now)
    const parsed = parseEvoMessageContent(data["message"])
    const preview = buildMessagePreview(parsed)

    await this.repository.createMessage({
      conversation: { connect: { id: conversation.id } },
      team: { connect: { id: teamId } },
      config: { connect: { id: configId } },
      providerMessageId,
      direction,
      messageType: parsed.messageType,
      status: fromMe ? "SENT" : "RECEIVED",
      contentText: parsed.contentText,
      mediaUrl: parsed.mediaUrl,
      mediaMimeType: parsed.mediaMimeType,
      mediaFileName: parsed.mediaFileName,
      linkPreview: parsed.linkPreview ?? undefined,
      caption: parsed.caption,
      senderDisplayName: !fromMe && isGroup ? pushName ?? null : undefined,
      senderPhone: fromMe ? undefined : normalizedPhone,
      recipientPhone: fromMe ? normalizedPhone : undefined,
      sentAt: now,
      rawPayload: data as Prisma.InputJsonValue,
    })

    const createdMessage = await this.repository.findMessageByProviderMessageId(teamId, providerMessageId)

    if (!fromMe) {
      await this.repository.createUsageEvent({
        team: { connect: { id: teamId } },
        config: { connect: { id: configId } },
        periodKey,
        eventType: "INBOUND_MESSAGE",
        direction: "INBOUND",
        countedTowardsQuota: false,
        providerMessageId,
      })
    }

    await this.repository.updateConversation(conversation.id, {
      lastMessageAt: now,
      lastMessagePreview: preview,
      ...(!isGroup && pushName && pushName !== conversation.contactName
        ? { contactName: pushName }
        : {}),
      ...(fromMe ? { lastOutboundAt: now } : { lastInboundAt: now, unreadCount: { increment: 1 } }),
    })

    if (createdMessage) {
      try {
        const refreshedConversation = await this.repository.findConversationById(conversation.id)
        if (refreshedConversation) {
          await syncWhatsappMessageToCdpUseCase.execute({
            teamId,
            message: createdMessage,
            conversation: refreshedConversation,
          })
        }
      } catch (cdpError) {
        console.error("[ProcessEvoWebhookUseCase][handleMessagesUpsert] CDP sync failed", cdpError)
      }

      if (!fromMe) {
        try {
          await processWhatsAppInboundAutoResponseUseCase.execute({
            teamId,
            configId,
            conversationId: conversation.id,
            externalChatId: remoteJid,
            inboundMessageId: createdMessage.id,
            inboundText: parsed.contentText,
            contactName: pushName,
            normalizedPhone,
          })
        } catch (autoResponseError) {
          console.error("[ProcessEvoWebhookUseCase][handleMessagesUpsert] Auto-response failed", autoResponseError)
        }
      }
    }
  }

  private async handleConnectionUpdate(
    configId: string,
    data: unknown
  ): Promise<void> {
    const config = await this.repository.findConfigById(configId)
    const record =
      typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
    const state = typeof record["state"] === "string" ? record["state"].toLowerCase() : ""
    const now = new Date()

    let status: WhatsAppConnectionStatus
    const extraFields: Record<string, unknown> = {}

    if (state === "open") {
      status = "CONNECTED"
      extraFields["lastConnectedAt"] = now
      extraFields["qrCodeText"] = null
      extraFields["qrCodeImageUrl"] = null

      const instanceObj = (record["instance"] as Record<string, unknown> | undefined) ?? {}
      const owner = typeof instanceObj["owner"] === "string" ? instanceObj["owner"] : undefined
      if (owner) {
        extraFields["phoneNumber"] = normalizeRemoteJid(owner)
      }
    } else if (state === "close") {
      status = "DISCONNECTED"
      extraFields["lastDisconnectedAt"] = now
    } else {
      status = "QR_READY"
    }

    console.info("[ProcessEvoWebhookUseCase][handleConnectionUpdate] State:", state, "→", status)

    await this.repository.updateConfig(configId, {
      status,
      ...extraFields,
    })

    if (state === "open" && config && config.historySyncStatus !== "COMPLETED") {
      void syncWhatsAppHistoryUseCase.execute({ teamId: config.teamId }).catch((error) => {
        console.error("[ProcessEvoWebhookUseCase][handleConnectionUpdate] History sync failed", error)
      })
    }
  }

  private async handleQrCodeUpdated(configId: string, data: unknown): Promise<void> {
    const existing = await this.repository.findConfigById(configId)
    const record =
      typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
    const qrcodeObj = (record["qrcode"] as Record<string, unknown> | undefined) ?? {}
    const qrCodeText = typeof qrcodeObj["code"] === "string" ? qrcodeObj["code"] : null
    const qrBase64 = typeof qrcodeObj["base64"] === "string" ? qrcodeObj["base64"] : null

    if (!qrCodeText || !qrBase64) return
    if (existing?.qrCodeText === qrCodeText) return

    const qrCodeImageUrl = toQrCodeImageUrl(qrBase64)

    console.info("[ProcessEvoWebhookUseCase][handleQrCodeUpdated] Updating QR code")

    await this.repository.updateConfig(configId, {
      status: "QR_READY",
      qrCodeText,
      qrCodeImageUrl,
    })
  }

  private async handleMessagesUpdate(teamId: string, data: unknown): Promise<void> {
    for (const item of asRecordArray(data)) {
      const keyObj = (item["key"] as Record<string, unknown> | undefined) ?? {}
      const providerMessageId = typeof keyObj["id"] === "string" ? keyObj["id"] : undefined
      if (!providerMessageId) continue

      const updateObj = (item["update"] as Record<string, unknown> | undefined) ?? {}
      const rawStatus =
        normalizeMessageStatus(updateObj["status"]) ||
        normalizeMessageStatus(item["status"])

      await this.applyOutboundMessageStatus(teamId, providerMessageId, rawStatus)
    }
  }

  private async handleSendMessage(teamId: string, data: unknown): Promise<void> {
    const record =
      typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
    const keyObj = (record["key"] as Record<string, unknown> | undefined) ?? {}
    const providerMessageId = typeof keyObj["id"] === "string" ? keyObj["id"] : undefined

    if (!providerMessageId) {
      console.info("[ProcessEvoWebhookUseCase][handleSendMessage] No message ID, skipping")
      return
    }

    const rawStatus = normalizeMessageStatus(record["status"])
    await this.applyOutboundMessageStatus(teamId, providerMessageId, rawStatus)
  }

  private async applyOutboundMessageStatus(
    teamId: string,
    providerMessageId: string,
    rawStatus: string
  ): Promise<void> {
    if (!rawStatus) return

    const existing = await this.repository.findMessageByProviderMessageId(teamId, providerMessageId)
    if (!existing) {
      console.info(
        "[ProcessEvoWebhookUseCase][applyOutboundMessageStatus] Message not found, skipping",
        providerMessageId
      )
      return
    }

    const now = new Date()
    let status: WhatsAppMessageStatus | undefined
    const updateData: Parameters<typeof this.repository.updateMessageStatus>[1] = {
      status: existing.status as WhatsAppMessageStatus,
    }

    if (rawStatus === "SENT" || rawStatus === "SERVER_ACK") {
      status = "SENT"
    } else if (rawStatus === "DELIVERY_ACK" || rawStatus === "DELIVERED") {
      status = "DELIVERED"
      updateData.deliveredAt = now
    } else if (rawStatus === "READ" || rawStatus === "PLAYED") {
      status = "READ"
      updateData.readAt = now
    } else if (rawStatus === "FAILED" || rawStatus === "ERROR") {
      status = "FAILED"
      updateData.failedAt = now
    }

    if (status && shouldApplyMessageStatus(existing.status, status)) {
      updateData.status = status
      console.info(
        "[ProcessEvoWebhookUseCase][applyOutboundMessageStatus] Updating message status to",
        status
      )
      await this.repository.updateMessageStatus(existing.id, updateData)
    } else if (status) {
      console.info(
        "[ProcessEvoWebhookUseCase][applyOutboundMessageStatus] Skipping status regression",
        existing.status,
        "→",
        status,
        providerMessageId
      )
    }
  }
}

export const processEvoWebhookUseCase = new ProcessEvoWebhookUseCase(whatsAppRepository)
