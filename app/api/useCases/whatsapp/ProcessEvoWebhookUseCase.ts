import { Output } from "@/lib/output"
import type {
  IWhatsAppRepository,
  WhatsAppConversationSelect,
  WhatsAppMessageSelect,
} from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { buildPeriodKey, normalizeRemoteJid, resolveNormalizedPhone, isGroupChat } from "@/app/api/services/whatsapp/phoneUtils"
import {
  buildMessagePreview,
  normalizeMessageStatus,
  normalizeMessagesUpsertItems,
  parseEvoMessageContent,
} from "@/app/api/services/whatsapp/evo/parseEvoMessageContent"
import { toQrCodeImageUrl } from "@/app/api/services/whatsapp/qrCodeUtils"
import {
  assertNoConflictingPhoneOnSameTeam,
  assertPhoneNumberCanConnect,
  toStoredNormalizedPhone,
} from "@/app/api/services/whatsapp/WhatsAppPhonePolicy"
import { syncWhatsAppHistoryUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsAppHistoryUseCase"
import { syncWhatsappMessageToCdpUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsappMessageToCdpUseCase"
import { processWhatsAppInboundAutoResponseUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsAppInboundAutoResponseUseCase"
import { Prisma, type WhatsAppConnectionStatus, type WhatsAppMessageStatus } from "@prisma/client"
import { sanitizeDbText, stripHtmlTags } from "@/lib/whatsapp/sanitize-db-text"
import {
  resolveContactNameUpdate,
  type ContactNameSource,
} from "@/lib/whatsapp/contact-name"

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

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

const CONTACTS_LOOKUP_CHUNK_SIZE = 500
const CONTACTS_UPDATE_CONCURRENCY = 20

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
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
      } else if (eventType === "MESSAGES_DELETE" || eventType === "MESSAGES.DELETE") {
        await this.handleMessagesDelete(input.teamId, data)
      } else if (
        eventType === "CONTACTS_UPSERT" || eventType === "CONTACTS.UPSERT" ||
        eventType === "CONTACTS_UPDATE" || eventType === "CONTACTS.UPDATE"
      ) {
        await this.handleContactsUpsert(input.teamId, data)
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
    const pushName = typeof data["pushName"] === "string" ? stripHtmlTags(sanitizeDbText(data["pushName"])) ?? undefined : undefined

    if (!remoteJid || !providerMessageId) {
      console.info("[ProcessEvoWebhookUseCase][handleMessagesUpsert] Missing remoteJid or id, skipping")
      return
    }

    const phoneRaw = normalizeRemoteJid(remoteJid)
    const normalizedPhone = resolveNormalizedPhone(remoteJid, phoneRaw)
    const isGroup = isGroupChat(remoteJid)

    const routed = await this.resolveTargetTeamContext(teamId, configId, normalizedPhone, isGroup)

    const conversation = await this.repository.findOrCreateConversation({
      teamId: routed.teamId,
      configId: routed.configId,
      externalChatId: remoteJid,
      contactPhone: phoneRaw,
      normalizedPhone,
      contactName: isGroup ? undefined : pushName,
    })

    const existing = await this.repository.findMessageByProviderMessageId(routed.teamId, providerMessageId)
    const isRedelivery = existing !== null

    const direction = fromMe ? "OUTBOUND" : "INBOUND"
    const now = new Date()
    const periodKey = buildPeriodKey(now)
    const parsed = parseEvoMessageContent(data["message"])
    const preview = buildMessagePreview(parsed)
    const safeContentText = sanitizeDbText(parsed.contentText)
    const safeCaption = sanitizeDbText(parsed.caption)

    if (!isRedelivery) {
      let messageCreated = false
      try {
        await this.repository.createMessage({
          conversation: { connect: { id: conversation.id } },
          team: { connect: { id: routed.teamId } },
          config: { connect: { id: routed.configId } },
          providerMessageId,
          direction,
          messageType: parsed.messageType,
          status: fromMe ? "SENT" : "RECEIVED",
          contentText: safeContentText,
          mediaUrl: parsed.mediaUrl,
          mediaMimeType: parsed.mediaMimeType,
          mediaFileName: parsed.mediaFileName,
          linkPreview: parsed.linkPreview ?? undefined,
          caption: safeCaption,
          senderDisplayName: !fromMe && isGroup ? pushName ?? null : undefined,
          senderPhone: fromMe ? undefined : normalizedPhone,
          recipientPhone: fromMe ? normalizedPhone : undefined,
          sentAt: now,
          rawPayload: data as Prisma.InputJsonValue,
        })
        messageCreated = true
      } catch (createError) {
        if (!isUniqueConstraintError(createError)) {
          throw createError
        }
        console.info(
          "[ProcessEvoWebhookUseCase][handleMessagesUpsert] Race on createMessage, healing as redelivery",
          providerMessageId
        )
      }

      if (messageCreated) {
        await this.applyConversationSideEffects({
          conversationId: conversation.id,
          conversationContactName: conversation.contactName,
          conversationContactNameSource: conversation.contactNameSource as ContactNameSource,
          fromMe,
          isGroup,
          now,
          preview,
          pushName,
        })
      }
    } else {
      console.info(
        "[ProcessEvoWebhookUseCase][handleMessagesUpsert] Message already exists, healing pending side effects",
        providerMessageId
      )
      await this.healConversationSideEffectsIfNeeded({
        conversation,
        existingMessage: existing,
        fromMe,
        isGroup,
        preview,
        pushName,
      })
    }

    const createdMessage = await this.repository.findMessageByProviderMessageId(
      routed.teamId,
      providerMessageId
    )

    if (!fromMe) {
      try {
        await this.repository.createUsageEvent({
          team: { connect: { id: routed.teamId } },
          config: { connect: { id: routed.configId } },
          periodKey,
          eventType: "INBOUND_MESSAGE",
          direction: "INBOUND",
          countedTowardsQuota: false,
          providerMessageId,
        })
      } catch (usageError) {
        if (!isUniqueConstraintError(usageError)) {
          console.error(
            "[ProcessEvoWebhookUseCase][handleMessagesUpsert] Usage event creation failed",
            usageError
          )
        }
      }
    }

    if (createdMessage) {
      try {
        const refreshedConversation = await this.repository.findConversationById(conversation.id)
        if (refreshedConversation) {
          await syncWhatsappMessageToCdpUseCase.execute({
            teamId: routed.teamId,
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
            teamId: routed.teamId,
            configId: routed.configId,
            conversationId: conversation.id,
            externalChatId: remoteJid,
            inboundMessageId: createdMessage.id,
            inboundText: safeContentText,
            contactName: pushName,
            normalizedPhone,
          })
        } catch (autoResponseError) {
          console.error("[ProcessEvoWebhookUseCase][handleMessagesUpsert] Auto-response failed", autoResponseError)
        }
      }
    }
  }

  private async healConversationSideEffectsIfNeeded(input: {
    conversation: Pick<
      WhatsAppConversationSelect,
      "id" | "lastMessageAt" | "lastMessagePreview" | "contactName" | "contactNameSource"
    >
    existingMessage: Pick<WhatsAppMessageSelect, "sentAt">
    fromMe: boolean
    isGroup: boolean
    preview: string | null
    pushName: string | undefined
  }): Promise<void> {
    const messageSentAt = input.existingMessage.sentAt ?? new Date()
    const lastMessageAt = input.conversation.lastMessageAt
    const sideEffectsPending =
      lastMessageAt === null ||
      (input.existingMessage.sentAt !== null && lastMessageAt < input.existingMessage.sentAt)

    if (sideEffectsPending) {
      await this.applyConversationSideEffects({
        conversationId: input.conversation.id,
        conversationContactName: input.conversation.contactName,
        conversationContactNameSource: input.conversation.contactNameSource as ContactNameSource,
        fromMe: input.fromMe,
        isGroup: input.isGroup,
        now: messageSentAt,
        preview: input.preview,
        pushName: input.pushName,
      })
      return
    }

    const safeUpdate: Prisma.WhatsAppConversationUpdateInput = {}
    const contactNameUpdate = this.resolvePushNameUpdate({
      conversationContactName: input.conversation.contactName,
      conversationContactNameSource: input.conversation.contactNameSource as ContactNameSource,
      pushName: input.pushName,
      isGroup: input.isGroup,
    })
    if (contactNameUpdate) {
      Object.assign(safeUpdate, contactNameUpdate)
    }
    if (input.preview && !input.conversation.lastMessagePreview) {
      safeUpdate.lastMessagePreview = input.preview
    }
    if (Object.keys(safeUpdate).length === 0) return

    try {
      await this.repository.updateConversation(input.conversation.id, safeUpdate)
    } catch (error) {
      console.error(
        "[ProcessEvoWebhookUseCase][healConversationSideEffectsIfNeeded] Safe heal failed",
        error
      )
    }
  }

  private resolvePushNameUpdate(input: {
    conversationContactName: string | null
    conversationContactNameSource: ContactNameSource
    pushName: string | undefined
    isGroup: boolean
  }): { contactName: string; contactNameSource: ContactNameSource } | null {
    if (input.isGroup || !input.pushName) return null
    return resolveContactNameUpdate({
      currentName: input.conversationContactName,
      currentSource: input.conversationContactNameSource,
      incomingName: input.pushName,
      incomingSource: "PUSH_NAME",
    })
  }

  private async applyConversationSideEffects(input: {
    conversationId: string
    conversationContactName: string | null
    conversationContactNameSource: ContactNameSource
    fromMe: boolean
    isGroup: boolean
    now: Date
    preview: string | null
    pushName: string | undefined
  }): Promise<void> {
    const contactNameUpdate = this.resolvePushNameUpdate({
      conversationContactName: input.conversationContactName,
      conversationContactNameSource: input.conversationContactNameSource,
      pushName: input.pushName,
      isGroup: input.isGroup,
    })

    const fullUpdate: Prisma.WhatsAppConversationUpdateInput = {
      lastMessageAt: input.now,
      lastMessagePreview: input.preview,
      ...(contactNameUpdate ?? {}),
      ...(input.fromMe
        ? { lastOutboundAt: input.now }
        : { lastInboundAt: input.now, unreadCount: { increment: 1 } }),
    }

    try {
      await this.repository.updateConversation(input.conversationId, fullUpdate)
      return
    } catch (error) {
      console.error(
        "[ProcessEvoWebhookUseCase][applyConversationSideEffects] Full update failed, retrying minimal",
        error
      )
    }

    try {
      await this.repository.updateConversation(input.conversationId, {
        lastMessageAt: input.now,
        ...(input.fromMe
          ? { lastOutboundAt: input.now }
          : { lastInboundAt: input.now, unreadCount: { increment: 1 } }),
      })
    } catch (minimalError) {
      console.error(
        "[ProcessEvoWebhookUseCase][applyConversationSideEffects] Minimal update failed",
        minimalError
      )
    }
  }

  private async resolveTargetTeamContext(
    fallbackTeamId: string,
    fallbackConfigId: string,
    normalizedPhone: string,
    isGroup: boolean
  ): Promise<{ teamId: string; configId: string }> {
    if (isGroup) {
      return { teamId: fallbackTeamId, configId: fallbackConfigId }
    }

    const masterCtx = await this.repository.findTeamMasterContext(fallbackTeamId)
    if (!masterCtx) {
      return { teamId: fallbackTeamId, configId: fallbackConfigId }
    }

    const targetTeamId = await this.repository.findLeadTeamIdByPhoneForMaster(
      masterCtx.masterId,
      normalizedPhone,
      fallbackTeamId
    )

    if (targetTeamId === fallbackTeamId) {
      return { teamId: fallbackTeamId, configId: fallbackConfigId }
    }

    const targetConfig = await this.repository.findConfigByTeamId(targetTeamId)
    if (!targetConfig) {
      return { teamId: fallbackTeamId, configId: fallbackConfigId }
    }

    return { teamId: targetTeamId, configId: targetConfig.id }
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
    const extraFields: Prisma.TeamWhatsAppConfigUpdateInput = {}

    if (state === "open") {
      status = "CONNECTED"
      extraFields.lastConnectedAt = now
      extraFields.qrCodeText = null
      extraFields.qrCodeImageUrl = null

      const instanceObj = (record["instance"] as Record<string, unknown> | undefined) ?? {}
      const owner = typeof instanceObj["owner"] === "string" ? instanceObj["owner"] : undefined
      if (owner) {
        const phoneNumber = normalizeRemoteJid(owner)
        extraFields.phoneNumber = phoneNumber
        const normalizedPhone = toStoredNormalizedPhone(phoneNumber)
        extraFields.normalizedPhone = normalizedPhone

        if (config && !config.primaryConfigId) {
          try {
            await assertNoConflictingPhoneOnSameTeam({
              teamId: config.teamId,
              configId: config.id,
              nextNormalizedPhone: normalizedPhone,
            })
            await assertPhoneNumberCanConnect({
              teamId: config.teamId,
              normalizedPhone,
              configId: config.id,
            })
          } catch (error) {
            console.error("[ProcessEvoWebhookUseCase][handleConnectionUpdate] Phone policy rejected", error)
            return
          }
        }
      }
    } else if (state === "close") {
      status = "DISCONNECTED"
      extraFields.lastDisconnectedAt = now
      extraFields.phoneNumber = null
      extraFields.normalizedPhone = null
    } else {
      status = "QR_READY"
    }

    console.info("[ProcessEvoWebhookUseCase][handleConnectionUpdate] State:", state, "→", status)

    await this.repository.updateConfig(configId, {
      status,
      ...extraFields,
    })

    if (config && !config.primaryConfigId) {
      const mirrors = await this.repository.findMirroredConfigs(configId)
      if (mirrors.length > 0) {
        const mirrorFields: Prisma.TeamWhatsAppConfigUpdateInput = {
          status,
          ...(state === "open"
            ? {
                lastConnectedAt: now,
                qrCodeText: null,
                qrCodeImageUrl: null,
                phoneNumber: extraFields.phoneNumber ?? undefined,
                normalizedPhone: extraFields.normalizedPhone ?? undefined,
              }
            : state === "close"
              ? {
                  lastDisconnectedAt: now,
                  phoneNumber: null,
                  normalizedPhone: null,
                }
              : {}),
        }
        await Promise.all(
          mirrors.map((mirror) => this.repository.updateConfig(mirror.id, mirrorFields))
        )
      }
    }

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

  private async handleMessagesDelete(teamId: string, data: unknown): Promise<void> {
    const record =
      typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}

    const keyObj = (record["key"] as Record<string, unknown> | undefined) ?? {}
    const providerMessageId = typeof keyObj["id"] === "string" ? keyObj["id"] : undefined

    if (!providerMessageId) {
      console.info("[ProcessEvoWebhookUseCase][handleMessagesDelete] No message ID, skipping")
      return
    }

    const existing = await this.repository.findMessageByProviderMessageId(teamId, providerMessageId)
    if (!existing) {
      console.info(
        "[ProcessEvoWebhookUseCase][handleMessagesDelete] Message not found, skipping",
        providerMessageId
      )
      return
    }

    console.info("[ProcessEvoWebhookUseCase][handleMessagesDelete] Marking message as deleted", providerMessageId)

    await this.repository.updateMessageStatus(existing.id, {
      status: "FAILED",
      failedAt: new Date(),
    })
  }

  private resolveContactNamesFromWebhook(
    currentName: string | null,
    currentSource: ContactNameSource,
    payload: { profileName?: string; pushName?: string }
  ): { contactName: string; contactNameSource: ContactNameSource } | null {
    let name = currentName
    let source = currentSource
    let lastUpdate: { contactName: string; contactNameSource: ContactNameSource } | null = null

    const phoneBookUpdate = resolveContactNameUpdate({
      currentName: name,
      currentSource: source,
      incomingName: payload.profileName,
      incomingSource: "PHONE_BOOK",
    })
    if (phoneBookUpdate) {
      name = phoneBookUpdate.contactName
      source = phoneBookUpdate.contactNameSource
      lastUpdate = phoneBookUpdate
    }

    const pushUpdate = resolveContactNameUpdate({
      currentName: name,
      currentSource: source,
      incomingName: payload.pushName,
      incomingSource: "PUSH_NAME",
    })
    return pushUpdate ?? lastUpdate
  }

  private async handleContactsUpsert(teamId: string, data: unknown): Promise<void> {
    const contacts = asRecordArray(data)
    if (contacts.length === 0) return

    const namesByRemoteJid = new Map<string, { profileName?: string; pushName?: string }>()
    for (const contact of contacts) {
      const remoteJid = typeof contact["id"] === "string"
        ? contact["id"]
        : typeof contact["remoteJid"] === "string"
          ? contact["remoteJid"]
          : undefined

      if (!remoteJid) continue

      const pushName = typeof contact["pushName"] === "string"
        ? stripHtmlTags(sanitizeDbText(contact["pushName"])) ?? undefined
        : undefined
      const profileName = typeof contact["name"] === "string"
        ? stripHtmlTags(sanitizeDbText(contact["name"])) ?? undefined
        : undefined

      if (!profileName && !pushName) continue

      const existing = namesByRemoteJid.get(remoteJid) ?? {}
      if (profileName) existing.profileName = profileName
      if (pushName) existing.pushName = pushName
      namesByRemoteJid.set(remoteJid, existing)
    }

    if (namesByRemoteJid.size === 0) return

    const remoteJids = Array.from(namesByRemoteJid.keys())
    const conversationsByRemoteJid = new Map<string, WhatsAppConversationSelect>()
    for (const chunk of chunkArray(remoteJids, CONTACTS_LOOKUP_CHUNK_SIZE)) {
      const found = await this.repository.findConversationsByExternalChatIds(teamId, chunk)
      for (const conversation of found) {
        if (conversation.externalChatId) {
          conversationsByRemoteJid.set(conversation.externalChatId, conversation)
        }
      }
    }

    const pendingUpdates: Array<{
      conversationId: string
      contactName: string
      contactNameSource: ContactNameSource
    }> = []
    for (const [remoteJid, payload] of namesByRemoteJid) {
      const conversation = conversationsByRemoteJid.get(remoteJid)
      if (!conversation) continue

      const resolved = this.resolveContactNamesFromWebhook(
        conversation.contactName,
        conversation.contactNameSource as ContactNameSource,
        payload
      )
      if (resolved) {
        pendingUpdates.push({
          conversationId: conversation.id,
          contactName: resolved.contactName,
          contactNameSource: resolved.contactNameSource,
        })
      }
    }

    let updatedCount = 0
    for (const chunk of chunkArray(pendingUpdates, CONTACTS_UPDATE_CONCURRENCY)) {
      const results = await Promise.allSettled(
        chunk.map((update) =>
          this.repository.updateConversation(update.conversationId, {
            contactName: update.contactName,
            contactNameSource: update.contactNameSource,
          })
        )
      )
      for (const result of results) {
        if (result.status === "fulfilled") {
          updatedCount++
        } else {
          console.error(
            "[ProcessEvoWebhookUseCase][handleContactsUpsert] Failed to update conversation contact name",
            result.reason
          )
        }
      }
    }

    if (updatedCount > 0) {
      console.info(
        "[ProcessEvoWebhookUseCase][handleContactsUpsert] Updated",
        updatedCount,
        "conversation contact names"
      )
    }
  }
}

export const processEvoWebhookUseCase = new ProcessEvoWebhookUseCase(whatsAppRepository)
