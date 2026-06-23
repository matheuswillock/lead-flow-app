import { Output } from "@/lib/output"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { normalizePhone, buildPeriodKey } from "@/app/api/services/whatsapp/phoneUtils"
import {
  buildMessagePreview,
  normalizeMessageStatus,
  normalizeMessagesUpsertItems,
  parseEvoMessageContent,
} from "@/app/api/services/whatsapp/evo/parseEvoMessageContent"
import { toQrCodeImageUrl } from "@/app/api/services/whatsapp/qrCodeUtils"
import type { Prisma, WhatsAppConnectionStatus, WhatsAppMessageStatus } from "@prisma/client"

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

function normalizeRemoteJid(remoteJid: string): string {
  return remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "")
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
    const normalizedPhone = normalizePhone(phoneRaw)

    const conversation = await this.repository.findOrCreateConversation({
      teamId,
      configId,
      externalChatId: remoteJid,
      contactPhone: phoneRaw,
      normalizedPhone,
      contactName: pushName,
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
      caption: parsed.caption,
      senderPhone: fromMe ? undefined : normalizedPhone,
      recipientPhone: fromMe ? normalizedPhone : undefined,
      sentAt: now,
      rawPayload: data as Prisma.InputJsonValue,
    })

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
      ...(pushName && pushName !== conversation.contactName ? { contactName: pushName } : {}),
      ...(fromMe ? { lastOutboundAt: now } : { lastInboundAt: now, unreadCount: { increment: 1 } }),
    })
  }

  private async handleConnectionUpdate(
    configId: string,
    data: unknown
  ): Promise<void> {
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

    if (status) {
      updateData.status = status
      console.info(
        "[ProcessEvoWebhookUseCase][applyOutboundMessageStatus] Updating message status to",
        status
      )
      await this.repository.updateMessageStatus(existing.id, updateData)
    }
  }
}

export const processEvoWebhookUseCase = new ProcessEvoWebhookUseCase(whatsAppRepository)
