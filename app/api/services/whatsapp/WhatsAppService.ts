import type { IWhatsAppService, ConfigOutput, CreateWhatsAppConfigInput, CreateConversationInput, SendMessageInput, SendAutoResponseMessageInput, UsageSummaryOutput, SyncContactsOutput, SyncContactsOptions, SyncGroupParticipantsOutput, WhatsAppContactOutput, CanonicalWhatsAppContactOutput } from "./IWhatsAppService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { whatsAppContactRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppContactRepository"
import type { IWhatsAppProvider, WhatsAppProviderSendResult } from "./provider/IWhatsAppProvider"
import {
  buildMessagePreview,
} from "./parseMessageContent"
import { generateWebhookSecret, buildPeriodKey, normalizePhone, normalizeRemoteJid, extractOpaqueId, toWhatsAppJid, resolveNormalizedPhone, isGroupChat } from "./phoneUtils"
import { resolveConfigStatusFromProvider, toQrCodeImageUrl } from "./qrCodeUtils"
import type { Prisma, WhatsAppConnectionStatus } from "@prisma/client"
import type { WhatsAppConfigSelect, WhatsAppConversationSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"
import { teamHasWhatsAppFeature } from "@/lib/whatsapp/team-has-whatsapp-feature"
import { WhatsAppAutoResponseSendError } from "@/lib/whatsapp/whatsappAutoResponseSendError"
import { WhatsAppEngineFactory } from "@/lib/whatsapp/WhatsAppEngineFactory"
import { whatsAppAutoResponseRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppAutoResponseRepository"
import {
  assertNoConflictingPhoneOnSameTeam,
  assertPhoneNumberCanConnect,
  toStoredNormalizedPhone,
} from "./WhatsAppPhonePolicy"
import { resolveContactNameUpdate, type ContactNameSource } from "@/lib/whatsapp/contact-name"
import { readMediaAsBase64ForProvider, validateStoredMediaObject, assertMediaPathBelongsToTeam } from "./WhatsAppMediaStorage"
import { randomUUID } from "node:crypto"
import { formatPhoneE164, resolveContactIdentity } from "./ContactIdentityResolver"

export const WHATSAPP_HISTORY_SYNC_DAYS = 30

const CONFIG_SYNC_TTL_MS = 45_000

function resolveWebhookBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error("[WhatsAppService] NEXT_PUBLIC_APP_URL is not set")
  return appUrl.replace(/\/$/, "")
}

function toConfigOutput(config: WhatsAppConfigSelect): ConfigOutput {
  return {
    teamId: config.teamId,
    provider: config.provider,
    engine: config.engine,
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

  private providerFor(teamId: string): Promise<IWhatsAppProvider> {
    return WhatsAppEngineFactory.forTeam(teamId)
  }

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
    const webhookUrl = `${resolveWebhookBaseUrl()}/api/webhooks/whatsapp/openwa/${webhookSecret}`

    console.info("[WhatsAppService][createConfig] Creating instance", instanceName)

    // Persiste webhook secret antes do bootstrap OpenWA para webhooks antecipados resolverem.
    const pending = await whatsAppRepository.createConfig({
      team: { connect: { id: input.teamId } },
      instanceName,
      webhookSecret,
      usageLimitMonthly: input.usageLimitMonthly ?? 2000,
      status: "PENDING",
      createdBy: { connect: { id: input.profileId } },
      updatedBy: { connect: { id: input.profileId } },
    })

    try {
      const provider = await this.providerFor(input.teamId)
      const connectResult = await provider.connectInstance({
        instanceName,
        webhookUrl,
      })

      if (connectResult.adopted) {
        console.info(
          "[WhatsAppService][createConfig] Adopting existing OpenWA session",
          instanceName
        )
      }

      let qrCodeText = connectResult.qrCode?.text ?? null
      let qrCodeImageUrl = connectResult.qrCode?.base64
        ? toQrCodeImageUrl(connectResult.qrCode.base64)
        : null

      if (!qrCodeImageUrl && connectResult.status !== "open") {
        try {
          const qr = await provider.getQrCode(instanceName)
          qrCodeText = qr.text
          qrCodeImageUrl = toQrCodeImageUrl(qr.base64)
        } catch (error) {
          console.error("[WhatsAppService][createConfig] QR fetch after create failed", error)
        }
      }

      const status = resolveConfigStatusFromProvider(connectResult.status, Boolean(qrCodeImageUrl))

      let config = await whatsAppRepository.updateConfig(pending.id, {
        instanceId: connectResult.instanceId ?? undefined,
        status,
        qrCodeText,
        qrCodeImageUrl,
        updatedBy: { connect: { id: input.profileId } },
      })

      if (connectResult.status === "open") {
        config = await this.syncConfigWithProvider(config)
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

    const needsLiveSync =
      config.status === "QR_READY" ||
      config.status === "PENDING" ||
      (config.status === "DISCONNECTED" && Boolean(config.qrCodeImageUrl))

    // Evita chamada externa ao Gateway no caminho quente: só sincroniza se o
    // último sync tiver mais de CONFIG_SYNC_TTL_MS (exceto durante espera de QR).
    const lastSyncMs = config.lastSyncAt?.getTime() ?? 0
    if (!needsLiveSync && Date.now() - lastSyncMs < CONFIG_SYNC_TTL_MS) {
      return toConfigOutput(config)
    }

    const synced = await this.syncConfigWithProvider(config)
    return toConfigOutput(synced)
  }

  private async ensureWebhookConfigured(config: WhatsAppConfigSelect): Promise<void> {
    if (!config.webhookSecret || !config.instanceName) return

    const webhookUrl = `${resolveWebhookBaseUrl()}/api/webhooks/whatsapp/openwa/${config.webhookSecret}`
    try {
      const provider = await this.providerFor(config.teamId)
      await provider.setWebhook({
        instanceName: config.instanceName,
        webhookUrl,
      })
      console.info("[WhatsAppService][ensureWebhookConfigured] webhook reaplicado", {
        configId: config.id,
        instanceName: config.instanceName,
      })
    } catch (error) {
      // OpenWA configura webhook em startSession — setWebhook é capability error esperado.
      console.info("[WhatsAppService][ensureWebhookConfigured] setWebhook skip/erro", {
        configId: config.id,
        instanceName: config.instanceName,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  private async syncConfigWithProvider(
    config: WhatsAppConfigSelect
  ): Promise<WhatsAppConfigSelect> {
    try {
      await this.ensureWebhookConfigured(config)

      const provider = await this.providerFor(config.teamId)
      const { state } = await provider.getConnectionState(config.instanceName)
      const now = new Date()

      if (state === "open") {
        let phoneNumber = config.phoneNumber
        if (!phoneNumber) {
          try {
            const instance = await provider.getInstanceInfo(config.instanceName)
            if (instance?.owner) {
              phoneNumber = normalizeRemoteJid(instance.owner)
            }
          } catch (error) {
            console.error("[WhatsAppService][syncConfigWithProvider] fetchInstance failed", error)
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
      console.error("[WhatsAppService][syncConfigWithProvider]", error)
      return config
    }
  }

  async reconnect(teamId: string, profileId: string): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!existing) {
      throw new Error("Configuração não encontrada")
    }

    console.info("[WhatsAppService][reconnect] Fetching QR code for", existing.instanceName)

    await this.ensureWebhookConfigured(existing)

    const provider = await this.providerFor(teamId)
    const qr = await provider.getQrCode(existing.instanceName)

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
          profileId,
          "disconnect-idempotent"
        )
      }
      return toConfigOutput(existing)
    }

    let needsLogout = existing.status === "CONNECTED"
    const provider = await this.providerFor(teamId)
    if (!needsLogout) {
      try {
        const { state } = await provider.getConnectionState(existing.instanceName)
        needsLogout = state === "open"
      } catch (error) {
        console.error("[WhatsAppService][disconnect] getConnectionState failed", error)
      }
    }

    if (needsLogout) {
      console.info("[WhatsAppService][disconnect] Disconnecting instance", existing.instanceName)
      await provider.disconnect(existing.instanceName)
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
      profileId,
      "disconnect"
    )
  }

  private async promoteConfigToQrReady(
    configId: string,
    instanceName: string,
    profileId: string,
    label: string
  ): Promise<ConfigOutput> {
    try {
      const config = await whatsAppRepository.findConfigById(configId)
      if (!config) throw new Error("Configuração não encontrada")
      const provider = await this.providerFor(config.teamId)
      const qr = await provider.getQrCode(instanceName)
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
    const provider = await this.providerFor(input.teamId)

    let evoResult: { providerMessageId: string; status: string; messageKey?: Record<string, unknown> }
    let messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" = "TEXT"
    const contentText: string | undefined = input.contentText
    let mediaMimeType: string | undefined
    let mediaFileName: string | undefined
    let caption: string | undefined
    let preview: string

    // V3 callers create the local bubble and command atomically before this
    // provider call. The fallback keeps legacy auto/administrative callers
    // working during the flag rollout.
    const messageId = input.pendingMessageId ?? randomUUID()
    let storagePath: string | null = null
    let mediaSha256: string | null = null
    let mediaSizeBytes: number | null = null

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

      if (!assertMediaPathBelongsToTeam(input.media.storagePath, input.teamId)) {
        throw new Error("MEDIA_UNSUPPORTED")
      }
      if (!input.media.storagePath.startsWith(`${input.teamId}/${input.conversationId}/`)) {
        throw new Error("MEDIA_UNSUPPORTED")
      }

      const validated = await validateStoredMediaObject({
        storagePath: input.media.storagePath,
        expectedSha256: input.media.sha256,
        expectedSizeBytes: input.media.sizeBytes,
        mimeType: input.media.mimeType,
      })
      storagePath = input.media.storagePath
      mediaSha256 = validated.mediaSha256
      mediaSizeBytes = validated.mediaSizeBytes

      // OpenWA aceita Base64 no envio — convertemos só em memória no servidor.
      const base64 = await readMediaAsBase64ForProvider(input.media.storagePath)

      try {
        evoResult = await provider.sendMedia({
          instanceName: effectiveConfig.instanceName,
          recipientJid,
          mediatype: input.media.mediatype,
          mimeType: input.media.mimeType,
          fileName: input.media.fileName,
          base64,
          caption: input.media.caption,
          quoted: input.quotedProviderMessageId
            ? {
                providerMessageId: input.quotedProviderMessageId,
                fromMe: input.quotedFromMe ?? false,
                remoteJid: recipientJid,
              }
            : undefined,
        })
      } catch (error) {
        // Keep the private object for retry by clientMessageId; do not delete on provider failure.
        throw error
      }
    } else {
      const text = input.contentText?.trim()
      if (!text) {
        throw new Error("Mensagem não pode ser vazia")
      }
      preview = text.slice(0, 100)
      evoResult = await provider.sendText({
        instanceName: effectiveConfig.instanceName,
        recipientJid,
        text,
        mentioned: input.mentionedJids,
        linkPreview: true,
        quoted: input.quotedProviderMessageId
          ? {
              providerMessageId: input.quotedProviderMessageId,
              fromMe: input.quotedFromMe ?? false,
              remoteJid: recipientJid,
            }
          : undefined,
      })
    }

    console.info("[WhatsAppService][sendMessage] Provider accepted outbound message", {
      messageId,
    })

    const rawPayload: Prisma.InputJsonValue = input.media
      ? {
          key: (evoResult.messageKey ?? {
            remoteJid: recipientJid,
            fromMe: true,
            id: evoResult.providerMessageId,
          }) as Prisma.InputJsonValue,
          outboundMedia: {
            mimeType: input.media.mimeType,
            storagePath,
            mediaSha256,
            mediaSizeBytes,
          },
        }
      : {}

    let message: { id: string }
    try {
      message = input.pendingMessageId
        ? await whatsAppRepository.confirmOutboundMessage({
            messageId: input.pendingMessageId,
            providerMessageId: evoResult.providerMessageId,
            sentAt: now,
            rawPayload,
            storagePath,
            mediaSha256,
            mediaSizeBytes,
          })
        : await whatsAppRepository.createMessage({
            id: messageId,
            conversation: { connect: { id: input.conversationId } },
            team: { connect: { id: input.teamId } },
            config: { connect: { id: config.id } },
            ...(conversation.leadId ? { lead: { connect: { id: conversation.leadId } } } : {}),
            providerMessageId: evoResult.providerMessageId,
            ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
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
            storagePath,
            mediaSha256,
            mediaSizeBytes,
            ...(input.quotedMessageId
              ? { quotedMessage: { connect: { id: input.quotedMessageId } } }
              : {}),
            ...(input.quotedProviderMessageId
              ? { quotedProviderMessageId: input.quotedProviderMessageId }
              : {}),
            rawPayload,
          })
    } catch {
      // The provider accepted the send, so a local write failure is never a
      // definitive delivery failure. The durable command will reconcile it.
      throw new Error("provider_accepted_persistence_failed")
    }

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

    let providerResult: WhatsAppProviderSendResult
    try {
      const provider = await this.providerFor(input.teamId)
      providerResult = await provider.sendText({
        instanceName: config.instanceName,
        recipientJid,
        text,
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
        providerMessageId: providerResult.providerMessageId,
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
        providerMessageId: providerResult.providerMessageId,
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
    const selectedContact = input.contactId
      ? await whatsAppContactRepository.findCanonicalById(input.teamId, input.contactId)
      : null
    if (input.contactId && !selectedContact) throw new Error("Contato não encontrado")
    if (!input.phone && !selectedContact?.phoneE164) throw new Error("Telefone é obrigatório")
    const normalizedPhone = normalizePhone(selectedContact?.phoneE164 ?? input.phone ?? "")
    const canonical = selectedContact ?? await whatsAppContactRepository.findOrCreateCanonical({
      teamId: input.teamId,
      phoneE164: `+${normalizedPhone}`,
      name: input.contactName,
      nameSource: input.contactName ? "MANUAL" : "PHONE_NUMBER",
    })
    const externalChatId = toWhatsAppJid(normalizedPhone)

    let contactAvatarUrl: string | null = null
    const provider = await this.providerFor(input.teamId)
    try {
      contactAvatarUrl = await provider.fetchProfilePictureUrl({
        instanceName: effectiveConfig.instanceName,
        remoteJid: externalChatId,
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
      contactName: input.contactName ?? canonical.name ?? undefined,
      contactId: canonical.id,
    })

    await whatsAppRepository.updateConversation(conversation.id, {
      ...(contactAvatarUrl ? { contactAvatarUrl } : {}),
      ...(input.contactName
        ? { contactName: input.contactName, contactNameSource: "MANUAL" as const }
        : {}),
      assignedProfile: { connect: { id: input.profileId } },
      createdByProfile: { connect: { id: input.profileId } },
    })

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
      const provider = await this.providerFor(teamId)
      const chats = await provider.fetchChats(config.instanceName)

      for (const chat of chats) {
        const phoneRaw = normalizeRemoteJid(chat.remoteJid)
        const normalizedPhone = resolveNormalizedPhone(chat.remoteJid, phoneRaw)
        const isGroup = isGroupChat(chat.remoteJid)

        let contactAvatarUrl = chat.profilePicUrl
        if (!contactAvatarUrl && !isGroup) {
          contactAvatarUrl = await provider.fetchProfilePictureUrl({
            instanceName: config.instanceName,
            remoteJid: chat.remoteJid,
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

        const messages = await provider.fetchMessagesSince({
          instanceName: config.instanceName,
          remoteJid: chat.remoteJid,
          since,
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
            messageType: item.content.messageType as import("@prisma/client").WhatsAppMessageType,
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

  async syncContacts(
    teamId: string,
    conversationId?: string,
    options?: SyncContactsOptions
  ): Promise<SyncContactsOutput> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const provider = await this.providerFor(teamId)
    const contacts = await provider.fetchContacts(config.instanceName)
    const startedAt = Date.now()
    const batchSize = Math.max(1, options?.batchSize ?? 100)
    const timeBudgetMs = options?.timeBudgetMs ?? 40_000
    let offset = Math.max(0, options?.checkpoint?.offset ?? 0)
    let imported = options?.checkpoint?.imported ?? 0

    const now = new Date()
    const eligible = contacts.filter((contact) => resolveContactIdentity(contact.remoteJid).kind !== "GROUP")

    // Legacy directory upsert once per full run (offset 0). Resume skips re-upsert.
    if (offset === 0) {
      const upsertInputs = eligible.map((contact) => ({
        teamId,
        remoteJid: contact.remoteJid,
        opaqueId: extractOpaqueId(contact.remoteJid),
        phoneNumber: contact.phoneNumber ? normalizePhone(contact.phoneNumber) : null,
        displayName: contact.pushName?.trim() || null,
        pushName: contact.pushName?.trim() || null,
        source: "PHONE_CONTACTS" as const,
        lastSyncedAt: now,
      }))
      imported = await whatsAppContactRepository.upsertMany(upsertInputs)
    }

    // O sync de contatos enriquece o diretório, mas nunca vira fonte de verdade.
    while (offset < eligible.length) {
      if (Date.now() - startedAt > timeBudgetMs) {
        const checkpoint = { offset, imported, done: false }
        await options?.onProgress?.(checkpoint)
        return {
          imported,
          updatedConversations: 0,
          totalContacts: contacts.length,
          checkpoint,
        }
      }

      const slice = eligible.slice(offset, offset + batchSize)
      for (const contact of slice) {
        const identity = resolveContactIdentity(contact.remoteJid)
        if (identity.kind === "GROUP") continue
        const canonical = identity.kind === "PHONE" && identity.phoneE164
          ? await whatsAppContactRepository.findOrCreateCanonical({
              teamId,
              phoneE164: identity.phoneE164,
              name: contact.pushName,
              nameSource: contact.pushName ? "PUSH_NAME" : "PHONE_NUMBER",
            })
          : await whatsAppContactRepository.findOrCreateProvisional({
              teamId,
              remoteJid: identity.remoteJid,
              displayName: contact.pushName,
            })
        await whatsAppContactRepository.upsertIdentity({
          teamId,
          configId: config.id,
          contactId: canonical.id,
          remoteJid: identity.remoteJid,
          identityType: identity.kind,
          phoneE164: identity.phoneE164,
          mappingSource: "CONTACT_SYNC",
          verifiedAt: identity.kind === "PHONE" ? now : null,
          sendable: identity.kind === "PHONE",
        })
      }
      offset += slice.length
      await options?.onProgress?.({ offset, imported, done: false })
    }

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
      const checkpoint = { offset, imported, done: true }
      await options?.onProgress?.(checkpoint)
      return { imported, updatedConversations, totalContacts: contacts.length, checkpoint }
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

    const checkpoint = { offset, imported, done: true }
    await options?.onProgress?.(checkpoint)
    return { imported, updatedConversations, totalContacts: contacts.length, checkpoint }
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

    const provider = await this.providerFor(teamId)
    const participants = await provider.fetchGroupParticipants({
      instanceName: config.instanceName,
      groupJid,
    })

    const phoneContacts = await provider.fetchContacts(config.instanceName)
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

  async createOrGetContact(input: { teamId: string; phone: string; name?: string }): Promise<CanonicalWhatsAppContactOutput> {
    const phoneE164 = `+${normalizePhone(input.phone)}`
    const row = await whatsAppContactRepository.findOrCreateCanonical({
      teamId: input.teamId,
      phoneE164,
      name: input.name,
      nameSource: input.name ? "MANUAL" : "PHONE_NUMBER",
    })
    return { id: row.id, name: row.name, phoneE164: row.phoneE164, formattedPhone: formatPhoneE164(row.phoneE164), syncState: row.syncState }
  }

  async updateContact(input: { teamId: string; contactId: string; phone?: string; name?: string | null }): Promise<CanonicalWhatsAppContactOutput> {
    const row = await whatsAppContactRepository.updateCanonical({
      teamId: input.teamId,
      contactId: input.contactId,
      ...(input.phone ? { phoneE164: `+${normalizePhone(input.phone)}` } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
    })
    return { id: row.id, name: row.name, phoneE164: row.phoneE164, formattedPhone: formatPhoneE164(row.phoneE164), syncState: row.syncState }
  }

  async searchContacts(teamId: string, query: string): Promise<CanonicalWhatsAppContactOutput[]> {
    const rows = await whatsAppContactRepository.searchCanonical(teamId, query, 50)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phoneE164: row.phoneE164,
      formattedPhone: formatPhoneE164(row.phoneE164),
      syncState: row.syncState,
    }))
  }

  async searchInbox(teamId: string, query: string, limit = 20, visibility?: {
    contactWhere?: Prisma.TeamWhatsAppContactWhereInput
    conversationWhere?: Prisma.WhatsAppConversationWhereInput
  }): Promise<{
    conversations: WhatsAppConversationSelect[]
    contacts: Array<CanonicalWhatsAppContactOutput & { existingConversationId: string | null; isProvisional: boolean }>
    startNumber: { normalizedPhone: string; displayPhone: string } | null
  }> {
    const [conversations, contacts] = await Promise.all([
      whatsAppRepository.searchConversations(teamId, query, limit, visibility?.conversationWhere),
      whatsAppContactRepository.searchCanonical(teamId, query, 50, visibility?.contactWhere).then((rows) => rows.map((row) => ({
        id: row.id,
        name: row.name,
        phoneE164: row.phoneE164,
        formattedPhone: formatPhoneE164(row.phoneE164),
        syncState: row.syncState,
      }))),
    ])
    const enriched = await Promise.all(contacts.slice(0, limit).map(async (contact) => {
      const conversation = await whatsAppRepository.findConversationByContactId(teamId, contact.id, visibility?.conversationWhere)
      return { ...contact, existingConversationId: conversation?.id ?? null, isProvisional: contact.syncState === "UNRESOLVED" }
    }))
    const digits = query.replace(/\D/g, "")
    const normalizedPhone = digits.length >= 8 && digits.length <= 15 ? `+${normalizePhone(digits)}` : null
    return {
      conversations,
      contacts: enriched,
      startNumber: normalizedPhone ? { normalizedPhone, displayPhone: formatPhoneE164(normalizedPhone) ?? normalizedPhone } : null,
    }
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
