import type { IWhatsAppService, ConfigOutput, CreateWhatsAppConfigInput, CreateConversationInput, SendMessageInput, SendAutoResponseMessageInput, UsageSummaryOutput, SyncContactsOutput, SyncGroupParticipantsOutput, WhatsAppContactOutput } from "./IWhatsAppService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { whatsAppContactRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppContactRepository"
import type { IWhatsAppProvider, WhatsAppProviderSendResult } from "./provider/IWhatsAppProvider"
import { evolutionWhatsAppProvider } from "./provider/EvolutionWhatsAppProvider"
import { whatsAppAutoResponseRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppAutoResponseRepository"
import {
  buildMessagePreview,
} from "./evo/parseEvoMessageContent"
import { generateWebhookSecret, buildPeriodKey, normalizePhone, normalizeRemoteJid, extractOpaqueId, toWhatsAppJid, resolveNormalizedPhone, isGroupChat } from "./phoneUtils"
import { resolveConfigStatusFromEvo, toQrCodeImageUrl } from "./qrCodeUtils"
import type { Prisma, WhatsAppConnectionStatus } from "@prisma/client"
import type { WhatsAppConfigSelect, WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import { WhatsAppAutoResponseSendError } from "@/lib/whatsapp/whatsappAutoResponseSendError"
import {
  assertNoConflictingPhoneOnSameTeam,
  assertPhoneNumberCanConnect,
  toStoredNormalizedPhone,
} from "./WhatsAppPhonePolicy"
import { resolveContactNameUpdate, type ContactNameSource } from "@/lib/whatsapp/contact-name"

export const WHATSAPP_HISTORY_SYNC_DAYS = 30

const CONFIG_SYNC_TTL_MS = 45_000

function resolveWebhookBaseUrl(): string {
  const webhookPublic = process.env.EVO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, "")
  if (webhookPublic) return webhookPublic
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error("[WhatsAppService] NEXT_PUBLIC_APP_URL is not set")
  return appUrl.replace(/\/$/, "")
}

function toConfigOutput(config: WhatsAppConfigSelect): ConfigOutput {
  return {
    teamId: config.teamId,
    provider: config.provider,
    status: config.status,
    instanceName: config.instanceName,
    phoneNumber: config.phoneNumber,
    normalizedPhone: config.normalizedPhone,
    lastConnectedNormalizedPhone: config.lastConnectedNormalizedPhone,
    primaryConfigId: config.primaryConfigId,
    qrCodeImageUrl: config.qrCodeImageUrl
      ? toQrCodeImageUrl(config.qrCodeImageUrl)
      : null,
    qrCodeText: config.qrCodeText,
    usageLimitMonthly: config.usageLimitMonthly,
    lastConnectedAt: config.lastConnectedAt,
    lastDisconnectedAt: config.lastDisconnectedAt,
    lastSyncAt: config.lastSyncAt,
    historySyncStatus: config.historySyncStatus,
    historySyncStartedAt: config.historySyncStartedAt,
    historySyncCompletedAt: config.historySyncCompletedAt,
    historySyncError: config.historySyncError,
  }
}

class WhatsAppService implements IWhatsAppService {
  private historySyncInFlightByTeam = new Set<string>()

  constructor(private readonly provider: IWhatsAppProvider = evolutionWhatsAppProvider) {}

  async createConfig(input: CreateWhatsAppConfigInput): Promise<ConfigOutput> {
    const hasFeature = await teamHasWhatsAppFeature(input.teamId)
    if (!hasFeature) {
      throw new Error("Addon WhatsApp não está ativo para este time")
    }

    const existing = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (existing) {
      throw new Error("Configuração já existe para este time")
    }

    if (input.reuseFromTeamId) {
      if (!input.callerIsMaster) {
        throw new Error("Apenas o master da conta pode reutilizar número de outro time")
      }
      return this.createMirroredConfig(input)
    }

    const instanceName = `team_${input.teamId.replace(/-/g, "").slice(0, 16)}`
    const webhookSecret = generateWebhookSecret()
    const webhookUrl = `${resolveWebhookBaseUrl()}/api/webhooks/whatsapp/evolution/${webhookSecret}`

    console.info("[WhatsAppService][createConfig] Creating instance", instanceName)

    // Persist webhook secret before Evolution bootstrap so early webhooks resolve.
    const pending = await whatsAppRepository.createConfig({
      team: { connect: { id: input.teamId } },
      instanceName,
      webhookSecret,
      hostBaseUrl: input.hostBaseUrl ?? null,
      usageLimitMonthly: input.usageLimitMonthly ?? 2000,
      status: "PENDING",
      createdBy: { connect: { id: input.profileId } },
      updatedBy: { connect: { id: input.profileId } },
    })

    try {
      const evoResult = await this.provider.connectInstance({
        instanceName,
        webhookUrl,
        hostBaseUrl: input.hostBaseUrl,
      })

      if (evoResult.adopted) {
        console.info(
          "[WhatsAppService][createConfig] Adopting existing Evolution instance",
          instanceName
        )
      }

      let qrCodeText = evoResult.qrCode?.text ?? null
      let qrCodeImageUrl = evoResult.qrCode?.base64
        ? toQrCodeImageUrl(evoResult.qrCode.base64)
        : null

      if (!qrCodeImageUrl && evoResult.status !== "open") {
        try {
          const qr = await this.provider.getQrCode(instanceName, input.hostBaseUrl ?? undefined)
          qrCodeText = qr.text
          qrCodeImageUrl = toQrCodeImageUrl(qr.base64)
        } catch (error) {
          console.error("[WhatsAppService][createConfig] QR fetch after create failed", error)
        }
      }

      const status = resolveConfigStatusFromEvo(evoResult.status, Boolean(qrCodeImageUrl))

      let config = await whatsAppRepository.updateConfig(pending.id, {
        instanceId: evoResult.instanceId ?? undefined,
        status,
        qrCodeText,
        qrCodeImageUrl,
        updatedBy: { connect: { id: input.profileId } },
      })

      if (evoResult.status === "open") {
        config = await this.syncConfigWithEvolution(config)
      }

      await whatsAppAutoResponseRepository.seedDefaultRules(config.id)

      return toConfigOutput(config)
    } catch (error) {
      await whatsAppRepository.deleteConfig(pending.id)
      throw error
    }
  }

  private async createMirroredConfig(input: CreateWhatsAppConfigInput): Promise<ConfigOutput> {
    const sourceConfig = await whatsAppRepository.findConfigByTeamId(input.reuseFromTeamId!)
    if (!sourceConfig || sourceConfig.status !== "CONNECTED" || !sourceConfig.phoneNumber) {
      throw new Error("Time de origem não possui WhatsApp conectado")
    }

    const [sourceTeam, targetTeam] = await Promise.all([
      whatsAppRepository.findTeamMasterContext(sourceConfig.teamId),
      whatsAppRepository.findTeamMasterContext(input.teamId),
    ])

    if (!sourceTeam || !targetTeam || sourceTeam.masterId !== targetTeam.masterId) {
      throw new Error("Só é possível reutilizar número entre times do mesmo master")
    }

    const primaryConfig = sourceConfig.primaryConfigId
      ? await whatsAppRepository.findConfigById(sourceConfig.primaryConfigId)
      : sourceConfig

    if (!primaryConfig) {
      throw new Error("Configuração primária não encontrada")
    }

    const webhookSecret = generateWebhookSecret()
    const normalizedPhone =
      primaryConfig.normalizedPhone ??
      (primaryConfig.phoneNumber ? toStoredNormalizedPhone(primaryConfig.phoneNumber) : null)

    const config = await whatsAppRepository.createConfig({
      team: { connect: { id: input.teamId } },
      instanceName: primaryConfig.instanceName,
      instanceId: primaryConfig.instanceId,
      phoneNumber: primaryConfig.phoneNumber,
      normalizedPhone,
      hostBaseUrl: primaryConfig.hostBaseUrl,
      usageLimitMonthly: input.usageLimitMonthly ?? primaryConfig.usageLimitMonthly,
      status: primaryConfig.status as WhatsAppConnectionStatus,
      webhookSecret,
      primaryConfig: { connect: { id: primaryConfig.id } },
      lastConnectedAt: primaryConfig.lastConnectedAt,
      createdBy: { connect: { id: input.profileId } },
      updatedBy: { connect: { id: input.profileId } },
    })

    await whatsAppAutoResponseRepository.seedDefaultRules(config.id)
    return toConfigOutput(config)
  }

  async getConfig(teamId: string): Promise<ConfigOutput | null> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) return null

    // Evita chamada externa à Evolution no caminho quente: só sincroniza se o
    // último sync tiver mais de CONFIG_SYNC_TTL_MS.
    const lastSyncMs = config.lastSyncAt?.getTime() ?? 0
    if (Date.now() - lastSyncMs < CONFIG_SYNC_TTL_MS) {
      return toConfigOutput(config)
    }

    const synced = await this.syncConfigWithEvolution(config)
    return toConfigOutput(synced)
  }

  private async syncConfigWithEvolution(
    config: WhatsAppConfigSelect
  ): Promise<WhatsAppConfigSelect> {
    try {
      const { state } = await this.provider.getConnectionState(
        config.instanceName,
        config.hostBaseUrl ?? undefined
      )
      const now = new Date()

      if (state === "open") {
        let phoneNumber = config.phoneNumber
        if (!phoneNumber) {
          try {
            const instance = await this.provider.getInstanceInfo(
              config.instanceName,
              config.hostBaseUrl ?? undefined
            )
            if (instance?.owner) {
              phoneNumber = normalizeRemoteJid(instance.owner)
            }
          } catch (error) {
            console.error("[WhatsAppService][syncConfigWithEvolution] fetchInstance failed", error)
          }
        }

        if (phoneNumber) {
          const normalizedPhone = toStoredNormalizedPhone(phoneNumber)
          await assertNoConflictingPhoneOnSameTeam({
            teamId: config.teamId,
            configId: config.id,
            nextNormalizedPhone: normalizedPhone,
          })
          if (!config.primaryConfigId) {
            await assertPhoneNumberCanConnect({
              teamId: config.teamId,
              normalizedPhone,
              configId: config.id,
            })
          }

          return whatsAppRepository.updateConfig(config.id, {
            status: "CONNECTED",
            lastConnectedAt: config.lastConnectedAt ?? now,
            lastSyncAt: now,
            qrCodeText: null,
            qrCodeImageUrl: null,
            phoneNumber,
            normalizedPhone,
          })
        }

        return whatsAppRepository.updateConfig(config.id, {
          status: "CONNECTED",
          lastConnectedAt: config.lastConnectedAt ?? now,
          lastSyncAt: now,
          qrCodeText: null,
          qrCodeImageUrl: null,
        })
      }

      if (state === "close") {
        if (config.status === "DISCONNECTED") {
          return whatsAppRepository.updateConfig(config.id, { lastSyncAt: now })
        }
        return whatsAppRepository.updateConfig(config.id, {
          status: "DISCONNECTED",
          lastDisconnectedAt: config.lastDisconnectedAt ?? now,
          lastSyncAt: now,
        })
      }

      if (config.status !== "QR_READY" && config.status !== "PENDING") {
        return whatsAppRepository.updateConfig(config.id, {
          status: "QR_READY",
          lastSyncAt: now,
        })
      }

      return whatsAppRepository.updateConfig(config.id, { lastSyncAt: now })
    } catch (error) {
      console.error("[WhatsAppService][syncConfigWithEvolution]", error)
      return config
    }
  }

  async reconnect(teamId: string, profileId: string): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!existing) {
      throw new Error("Configuração não encontrada")
    }

    console.info("[WhatsAppService][reconnect] Fetching QR code for", existing.instanceName)

    const qr = await this.provider.getQrCode(existing.instanceName, existing.hostBaseUrl ?? undefined)

    const updated = await whatsAppRepository.updateConfig(existing.id, {
      status: "QR_READY",
      qrCodeText: qr.text,
      qrCodeImageUrl: toQrCodeImageUrl(qr.base64),
      updatedBy: { connect: { id: profileId } },
    })

    return toConfigOutput(updated)
  }

  async disconnect(teamId: string, profileId: string): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!existing) {
      throw new Error("Configuração não encontrada")
    }

    const disconnectedFields = {
      status: "DISCONNECTED" as const,
      lastDisconnectedAt: new Date(),
      phoneNumber: null,
      normalizedPhone: null,
      qrCodeText: null,
      qrCodeImageUrl: null,
    }

    if (existing.primaryConfigId) {
      const updated = await whatsAppRepository.updateConfig(existing.id, {
        ...disconnectedFields,
        updatedBy: { connect: { id: profileId } },
      })
      return toConfigOutput(updated)
    }

    if (existing.status === "DISCONNECTED") {
      if (!existing.qrCodeImageUrl) {
        return this.promoteConfigToQrReady(
          existing.id,
          existing.instanceName,
          existing.hostBaseUrl,
          profileId,
          "disconnect-idempotent"
        )
      }
      return toConfigOutput(existing)
    }

    let needsLogout = existing.status === "CONNECTED"
    if (!needsLogout) {
      try {
        const { state } = await this.provider.getConnectionState(
          existing.instanceName,
          existing.hostBaseUrl ?? undefined
        )
        needsLogout = state === "open"
      } catch (error) {
        console.error("[WhatsAppService][disconnect] getConnectionState failed", error)
      }
    }

    if (needsLogout) {
      console.info("[WhatsAppService][disconnect] Disconnecting instance", existing.instanceName)
      await this.provider.disconnect(
        existing.instanceName,
        existing.hostBaseUrl ?? undefined
      )
    }

    const mirrors = await whatsAppRepository.findMirroredConfigs(existing.id)
    await Promise.all(
      mirrors.map((mirror) => whatsAppRepository.updateConfig(mirror.id, disconnectedFields))
    )

    await whatsAppRepository.updateConfig(existing.id, {
      ...disconnectedFields,
      updatedBy: { connect: { id: profileId } },
    })

    return this.promoteConfigToQrReady(
      existing.id,
      existing.instanceName,
      existing.hostBaseUrl,
      profileId,
      "disconnect"
    )
  }

  private async promoteConfigToQrReady(
    configId: string,
    instanceName: string,
    hostBaseUrl: string | null,
    profileId: string,
    label: string
  ): Promise<ConfigOutput> {
    try {
      const qr = await this.provider.getQrCode(instanceName, hostBaseUrl ?? undefined)
      const updated = await whatsAppRepository.updateConfig(configId, {
        status: "QR_READY",
        qrCodeText: qr.text,
        qrCodeImageUrl: toQrCodeImageUrl(qr.base64),
        updatedBy: { connect: { id: profileId } },
      })
      return toConfigOutput(updated)
    } catch (error) {
      console.error(`[WhatsAppService][${label}] QR fetch failed`, error)
      const config = await whatsAppRepository.findConfigById(configId)
      if (!config) {
        throw new Error("Configuração não encontrada")
      }
      return toConfigOutput(config)
    }
  }

  async sendMessage(input: SendMessageInput): Promise<{ messageId: string }> {
    const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const effectiveConfig = await whatsAppRepository.resolveEffectiveConfig(config)

    const conversation = await whatsAppRepository.findConversationById(input.conversationId)

    if (!conversation) {
      throw new Error("Conversa não encontrada")
    }

    const recipientJid =
      conversation.externalChatId ?? toWhatsAppJid(normalizePhone(conversation.contactPhone))

    const now = new Date()
    const periodKey = buildPeriodKey(now)

    let evoResult: { providerMessageId: string; status: string; messageKey?: Record<string, unknown> }
    let messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" = "TEXT"
    const contentText: string | undefined = input.contentText
    let mediaMimeType: string | undefined
    let mediaFileName: string | undefined
    let caption: string | undefined
    let preview: string

    if (input.media) {
      messageType =
        input.media.mediatype === "image"
          ? "IMAGE"
          : input.media.mediatype === "document"
            ? "DOCUMENT"
            : input.media.mediatype === "audio"
              ? "AUDIO"
              : "VIDEO"
      mediaMimeType = input.media.mimeType
      mediaFileName = input.media.fileName
      caption = input.media.caption
      preview = input.media.caption ?? `[${messageType === "IMAGE" ? "Imagem" : messageType === "DOCUMENT" ? "Documento" : messageType === "AUDIO" ? "Áudio" : "Vídeo"}]`

      evoResult = await this.provider.sendMedia({
        instanceName: effectiveConfig.instanceName,
        recipientJid,
        mediatype: input.media.mediatype,
        mimeType: input.media.mimeType,
        fileName: input.media.fileName,
        base64: input.media.base64,
        caption: input.media.caption,
        hostBaseUrl: effectiveConfig.hostBaseUrl ?? undefined,
      })
    } else {
      const text = input.contentText?.trim()
      if (!text) {
        throw new Error("Mensagem não pode ser vazia")
      }
      preview = text.slice(0, 100)
      evoResult = await this.provider.sendText({
        instanceName: effectiveConfig.instanceName,
        recipientJid,
        text,
        mentioned: input.mentionedJids,
        linkPreview: true,
        hostBaseUrl: effectiveConfig.hostBaseUrl ?? undefined,
      })
    }

    console.info("[WhatsAppService][sendMessage] Sending message to", recipientJid)

    const rawPayload: Prisma.InputJsonValue = input.media
      ? {
          key: (evoResult.messageKey ?? {
            remoteJid: recipientJid,
            fromMe: true,
            id: evoResult.providerMessageId,
          }) as Prisma.InputJsonValue,
          outboundMedia: {
            base64: input.media.base64,
            mimeType: input.media.mimeType,
          },
        }
      : {}

    const message = await whatsAppRepository.createMessage({
      conversation: { connect: { id: input.conversationId } },
      team: { connect: { id: input.teamId } },
      config: { connect: { id: config.id } },
      ...(conversation.leadId ? { lead: { connect: { id: conversation.leadId } } } : {}),
      providerMessageId: evoResult.providerMessageId,
      direction: "OUTBOUND",
      messageType,
      status: "SENT",
      contentText: contentText ?? null,
      mediaMimeType: mediaMimeType ?? null,
      mediaFileName: mediaFileName ?? null,
      caption: caption ?? null,
      recipientPhone: normalizePhone(conversation.contactPhone),
      sentByProfile: { connect: { id: input.sentByProfileId } },
      sentAt: now,
      rawPayload,
    })

    await whatsAppRepository.createUsageEvent({
      team: { connect: { id: input.teamId } },
      config: { connect: { id: config.id } },
      periodKey,
      eventType: "OUTBOUND_MESSAGE",
      direction: "OUTBOUND",
      countedTowardsQuota: true,
      providerMessageId: evoResult.providerMessageId,
    })

    await whatsAppRepository.updateConversation(input.conversationId, {
      lastOutboundAt: now,
      lastMessageAt: now,
      lastMessagePreview: preview,
      ...(conversation.handoffMode === "BOT" ? { handoffMode: "HUMAN" as const } : {}),
      ...(conversation.assignedProfileId === null
        ? { assignedProfile: { connect: { id: input.sentByProfileId } } }
        : {}),
    })

    return { messageId: message.id }
  }

  async sendAutoResponseMessage(input: SendAutoResponseMessageInput): Promise<{ messageId: string }> {
    const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (!config) {
      throw new WhatsAppAutoResponseSendError("Configuração não encontrada", {
        providerMessageSent: false,
      })
    }
    if (config.status !== "CONNECTED") {
      throw new WhatsAppAutoResponseSendError("WhatsApp não está conectado", {
        providerMessageSent: false,
      })
    }

    const conversation = await whatsAppRepository.findConversationById(input.conversationId)
    if (!conversation) {
      throw new WhatsAppAutoResponseSendError("Conversa não encontrada", {
        providerMessageSent: false,
      })
    }

    const recipientJid =
      conversation.externalChatId ?? toWhatsAppJid(normalizePhone(conversation.contactPhone))

    const text = input.contentText.trim()
    if (!text) {
      throw new WhatsAppAutoResponseSendError("Mensagem não pode ser vazia", {
        providerMessageSent: false,
      })
    }

    const now = new Date()
    const periodKey = buildPeriodKey(now)
    const preview = text.slice(0, 100)

    let evoResult: WhatsAppProviderSendResult
    try {
      evoResult = await this.provider.sendText({
        instanceName: config.instanceName,
        recipientJid,
        text,
        hostBaseUrl: config.hostBaseUrl ?? undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem via WhatsApp"
      throw new WhatsAppAutoResponseSendError(message, { providerMessageSent: false })
    }

    console.info("[WhatsAppService][sendAutoResponseMessage] Sending auto reply to", recipientJid)

    let localMessageId: string | undefined
    try {
      const message = await whatsAppRepository.createMessage({
        conversation: { connect: { id: input.conversationId } },
        team: { connect: { id: input.teamId } },
        config: { connect: { id: config.id } },
        ...(conversation.leadId ? { lead: { connect: { id: conversation.leadId } } } : {}),
        providerMessageId: evoResult.providerMessageId,
        direction: "OUTBOUND",
        messageType: "TEXT",
        status: "SENT",
        contentText: text,
        recipientPhone: normalizePhone(conversation.contactPhone),
        isAutoResponse: true,
        autoResponseRule: { connect: { id: input.autoResponseRuleId } },
        sentAt: now,
        rawPayload: {},
      })
      localMessageId = message.id

      await whatsAppRepository.createUsageEvent({
        team: { connect: { id: input.teamId } },
        config: { connect: { id: config.id } },
        periodKey,
        eventType: "OUTBOUND_MESSAGE",
        direction: "OUTBOUND",
        countedTowardsQuota: true,
        providerMessageId: evoResult.providerMessageId,
      })

      await whatsAppRepository.updateConversation(input.conversationId, {
        lastOutboundAt: now,
        lastMessageAt: now,
        lastMessagePreview: preview,
      })

      return { messageId: message.id }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao persistir auto-resposta enviada"
      throw new WhatsAppAutoResponseSendError(message, {
        providerMessageSent: true,
        messageId: localMessageId,
      })
    }
  }

  async createConversation(input: CreateConversationInput): Promise<WhatsAppConversationSelect> {
    const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const effectiveConfig = await whatsAppRepository.resolveEffectiveConfig(config)
    const normalizedPhone = normalizePhone(input.phone)
    const externalChatId = toWhatsAppJid(normalizedPhone)

    let contactAvatarUrl: string | null = null
    try {
      contactAvatarUrl = await this.provider.fetchProfilePictureUrl({
        instanceName: effectiveConfig.instanceName,
        remoteJid: externalChatId,
        hostBaseUrl: effectiveConfig.hostBaseUrl ?? undefined,
      })
    } catch {
      contactAvatarUrl = null
    }

    const conversation = await whatsAppRepository.findOrCreateConversation({
      teamId: input.teamId,
      configId: config.id,
      externalChatId,
      contactPhone: normalizedPhone,
      normalizedPhone,
      contactName: input.contactName,
    })

    await whatsAppRepository.updateConversation(conversation.id, {
      ...(contactAvatarUrl ? { contactAvatarUrl } : {}),
      ...(input.contactName
        ? { contactName: input.contactName, contactNameSource: "MANUAL" as const }
        : {}),
      assignedProfile: { connect: { id: input.profileId } },
      createdByProfile: { connect: { id: input.profileId } },
    })

    if (input.initialMessage?.trim()) {
      await this.sendMessage({
        conversationId: conversation.id,
        teamId: input.teamId,
        sentByProfileId: input.profileId,
        contentText: input.initialMessage.trim(),
      })
    }

    const refreshed = await whatsAppRepository.findConversationById(conversation.id)
    if (!refreshed) {
      throw new Error("Conversa não encontrada após criação")
    }

    return refreshed
  }

  async syncTeamHistory(teamId: string): Promise<{ chats: number; messages: number }> {
    // Otimização local (evita round-trip ao banco em disparos repetidos no
    // mesmo processo); a fonte de verdade é o claim atômico via updateMany.
    if (this.historySyncInFlightByTeam.has(teamId)) {
      return { chats: 0, messages: 0 }
    }

    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) {
      throw new Error("Configuração WhatsApp não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const claimed = await whatsAppRepository.claimHistorySyncSlot(config.id)
    if (!claimed) {
      return { chats: 0, messages: 0 }
    }

    this.historySyncInFlightByTeam.add(teamId)

    const since = new Date(Date.now() - WHATSAPP_HISTORY_SYNC_DAYS * 24 * 60 * 60 * 1000)
    let chatCount = 0
    let messageCount = 0

    try {
      const chats = await this.provider.fetchChats(config.instanceName, config.hostBaseUrl ?? undefined)

      for (const chat of chats) {
        const phoneRaw = normalizeRemoteJid(chat.remoteJid)
        const normalizedPhone = resolveNormalizedPhone(chat.remoteJid, phoneRaw)
        const isGroup = isGroupChat(chat.remoteJid)

        let contactAvatarUrl = chat.profilePicUrl
        if (!contactAvatarUrl && !isGroup) {
          contactAvatarUrl = await this.provider.fetchProfilePictureUrl({
            instanceName: config.instanceName,
            remoteJid: chat.remoteJid,
            hostBaseUrl: config.hostBaseUrl ?? undefined,
          })
        }

        const conversation = await whatsAppRepository.findOrCreateConversation({
          teamId,
          configId: config.id,
          externalChatId: chat.remoteJid,
          contactPhone: phoneRaw,
          normalizedPhone,
          contactName: isGroup
            ? (chat.subject ?? chat.pushName ?? undefined)
            : (chat.pushName ?? undefined),
        })

        if (contactAvatarUrl && contactAvatarUrl !== conversation.contactAvatarUrl) {
          await whatsAppRepository.updateConversation(conversation.id, { contactAvatarUrl })
        }

        chatCount += 1

        const messages = await this.provider.fetchMessagesSince({
          instanceName: config.instanceName,
          remoteJid: chat.remoteJid,
          since,
          hostBaseUrl: config.hostBaseUrl ?? undefined,
        })

        let lastMessageAt: Date | null = conversation.lastMessageAt
        let lastMessagePreview: string | null = conversation.lastMessagePreview
        let lastInboundAt: Date | null = null
        let lastOutboundAt: Date | null = null
        let unreadIncrement = 0

        for (const item of messages) {
          const existing = await whatsAppRepository.findMessageByProviderMessageId(
            teamId,
            item.providerMessageId
          )
          if (existing) continue

          const preview = buildMessagePreview(item.content)
          const direction = item.fromMe ? "OUTBOUND" : "INBOUND"

          const inboundGroupSender =
            !item.fromMe && isGroup ? item.senderDisplayName : null

          await whatsAppRepository.createMessage({
            conversation: { connect: { id: conversation.id } },
            team: { connect: { id: teamId } },
            config: { connect: { id: config.id } },
            providerMessageId: item.providerMessageId,
            direction,
            messageType: item.content.messageType,
            status: item.fromMe ? "SENT" : "RECEIVED",
            contentText: item.content.contentText,
            mediaUrl: item.content.mediaUrl,
            mediaMimeType: item.content.mediaMimeType,
            mediaFileName: item.content.mediaFileName,
            linkPreview: item.content.linkPreview ?? undefined,
            caption: item.content.caption,
            senderDisplayName: inboundGroupSender,
            senderPhone: item.fromMe ? undefined : normalizedPhone,
            recipientPhone: item.fromMe ? normalizedPhone : undefined,
            sentAt: item.messageTimestamp,
            rawPayload: item.rawPayload as Prisma.InputJsonValue,
          })

          messageCount += 1

          if (!lastMessageAt || item.messageTimestamp > lastMessageAt) {
            lastMessageAt = item.messageTimestamp
            lastMessagePreview = preview
          }
          if (item.fromMe) {
            if (!lastOutboundAt || item.messageTimestamp > lastOutboundAt) {
              lastOutboundAt = item.messageTimestamp
            }
          } else {
            if (!lastInboundAt || item.messageTimestamp > lastInboundAt) {
              lastInboundAt = item.messageTimestamp
            }
            unreadIncrement += 1
          }
        }

        if (lastMessageAt) {
          const incomingName = isGroup ? chat.subject?.trim() : chat.pushName?.trim()
          const nameUpdate = incomingName
            ? resolveContactNameUpdate({
                currentName: conversation.contactName,
                currentSource: conversation.contactNameSource as ContactNameSource,
                incomingName,
                incomingSource: "PUSH_NAME",
              })
            : null

          await whatsAppRepository.updateConversation(conversation.id, {
            lastMessageAt,
            lastMessagePreview,
            ...(lastOutboundAt ? { lastOutboundAt } : {}),
            ...(lastInboundAt ? { lastInboundAt } : {}),
            ...(unreadIncrement > 0 ? { unreadCount: { increment: unreadIncrement } } : {}),
            ...(nameUpdate ?? {}),
          })
        }
      }

      await whatsAppRepository.updateConfig(config.id, {
        historySyncStatus: "COMPLETED",
        historySyncCompletedAt: new Date(),
        historySyncError: null,
      })

      return { chats: chatCount, messages: messageCount }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao sincronizar histórico"
      await whatsAppRepository.updateConfig(config.id, {
        historySyncStatus: "FAILED",
        historySyncError: message,
      })
      throw error
    } finally {
      this.historySyncInFlightByTeam.delete(teamId)
    }
  }

  async syncContacts(teamId: string, conversationId?: string): Promise<SyncContactsOutput> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const contacts = await this.provider.fetchContacts(
      config.instanceName,
      config.hostBaseUrl ?? undefined
    )

    const now = new Date()
    const upsertInputs = contacts.map((contact) => ({
      teamId,
      remoteJid: contact.remoteJid,
      opaqueId: extractOpaqueId(contact.remoteJid),
      phoneNumber: contact.phoneNumber ? normalizePhone(contact.phoneNumber) : null,
      displayName: contact.pushName?.trim() || null,
      pushName: contact.pushName?.trim() || null,
      source: "PHONE_CONTACTS" as const,
      lastSyncedAt: now,
    }))

    const imported = await whatsAppContactRepository.upsertMany(upsertInputs)

    const contactByJid = new Map(contacts.map((c) => [c.remoteJid, c]))
    const contactByPhone = new Map(
      contacts
        .filter((c) => c.phoneNumber)
        .map((c) => [normalizePhone(c.phoneNumber!), c])
    )

    let updatedConversations = 0

    const updateFromContact = async (
      conversation: Awaited<ReturnType<typeof whatsAppRepository.findConversationById>>
    ) => {
      if (!conversation) return false

      const jid = conversation.externalChatId ?? toWhatsAppJid(normalizePhone(conversation.contactPhone))
      const normalized = normalizePhone(conversation.normalizedPhone || conversation.contactPhone)

      const match =
        contactByJid.get(jid) ??
        contactByPhone.get(normalized)

      if (!match) return false

      const incomingName = match.pushName?.trim()
      const nameUpdate = incomingName
        ? resolveContactNameUpdate({
            currentName: conversation.contactName,
            currentSource: conversation.contactNameSource as ContactNameSource,
            incomingName,
            incomingSource: "PHONE_BOOK",
          })
        : null

      if (!nameUpdate) return false

      await whatsAppRepository.updateConversation(conversation.id, nameUpdate)
      return true
    }

    if (conversationId) {
      const conversation = await whatsAppRepository.findConversationById(conversationId)
      if (await updateFromContact(conversation)) {
        updatedConversations = 1
      }
      return { imported, updatedConversations, totalContacts: contacts.length }
    }

    const conversations = await whatsAppRepository.listConversations({
      teamId,
      page: 1,
      limit: 500,
      isArchived: false,
    })

    for (const conversation of conversations.conversations) {
      if (await updateFromContact(conversation)) {
        updatedConversations += 1
      }
    }

    return { imported, updatedConversations, totalContacts: contacts.length }
  }

  async syncGroupParticipants(teamId: string, conversationId: string): Promise<SyncGroupParticipantsOutput> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const conversation = await whatsAppRepository.findConversationById(conversationId)
    if (!conversation) {
      throw new Error("Conversa não encontrada")
    }

    const groupJid = conversation.externalChatId
    if (!groupJid || !isGroupChat(groupJid)) {
      throw new Error("Conversa não é um grupo")
    }

    const participants = await this.provider.fetchGroupParticipants({
      instanceName: config.instanceName,
      groupJid,
      hostBaseUrl: config.hostBaseUrl ?? undefined,
    })

    const phoneContacts = await this.provider.fetchContacts(
      config.instanceName,
      config.hostBaseUrl ?? undefined
    )
    const phoneContactByJid = new Map(phoneContacts.map((c) => [c.remoteJid, c]))

    const now = new Date()
    const upsertInputs = participants.map((participant) => {
      const agendaMatch = phoneContactByJid.get(participant.remoteJid)
      const pushName = participant.pushName?.trim() || agendaMatch?.pushName?.trim() || null
      return {
        teamId,
        remoteJid: participant.remoteJid,
        opaqueId: extractOpaqueId(participant.remoteJid),
        phoneNumber: participant.phoneNumber
          ? normalizePhone(participant.phoneNumber)
          : agendaMatch?.phoneNumber
            ? normalizePhone(agendaMatch.phoneNumber)
            : null,
        displayName: pushName,
        pushName,
        source: "GROUP_PARTICIPANT" as const,
        lastSyncedAt: now,
      }
    })

    const imported = await whatsAppContactRepository.upsertMany(upsertInputs)

    return { imported, totalParticipants: participants.length }
  }

  async listContacts(
    teamId: string,
    params?: {
      q?: string
      groupJid?: string
      contactWhere?: Prisma.TeamWhatsAppContactWhereInput
    }
  ): Promise<WhatsAppContactOutput[]> {
    const rows = await whatsAppContactRepository.listByTeam(teamId, {
      q: params?.q,
      groupJid: params?.groupJid,
      limit: 500,
      extraWhere: params?.contactWhere,
    })

    return rows.map((row) => ({
      id: row.id,
      remoteJid: row.remoteJid,
      opaqueId: row.opaqueId,
      phoneNumber: row.phoneNumber,
      displayName: row.displayName,
      pushName: row.pushName,
      source: row.source,
    }))
  }

  async getUsageSummary(teamId: string): Promise<UsageSummaryOutput> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    const usageLimitMonthly = config?.usageLimitMonthly ?? 2000
    const periodKey = buildPeriodKey()

    const { outboundCount, inboundCount } = await whatsAppRepository.getUsageSummary({
      teamId,
      periodKey,
    })

    const consumedPercentage =
      usageLimitMonthly > 0 ? (outboundCount / usageLimitMonthly) * 100 : 0

    let status: UsageSummaryOutput["status"]
    if (consumedPercentage > 150) {
      status = "EXCEEDED"
    } else if (consumedPercentage > 100) {
      status = "ATTENTION"
    } else {
      status = "WITHIN_LIMIT"
    }

    return {
      periodKey,
      usageLimitMonthly,
      outboundCount,
      inboundCount,
      consumedPercentage,
      status,
    }
  }
}

export const whatsAppService = new WhatsAppService()
