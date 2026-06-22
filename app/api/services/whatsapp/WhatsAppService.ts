import type { IWhatsAppService, ConfigOutput, CreateWhatsAppConfigInput, SendMessageInput, UsageSummaryOutput } from "./IWhatsAppService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { evoApiService } from "./evo/EvoApiService"
import { generateWebhookSecret, buildPeriodKey, normalizePhone } from "./phoneUtils"
import type { WhatsAppConfigSelect } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"

function toConfigOutput(config: WhatsAppConfigSelect): ConfigOutput {
  return {
    teamId: config.teamId,
    provider: config.provider,
    status: config.status,
    instanceName: config.instanceName,
    phoneNumber: config.phoneNumber,
    qrCodeImageUrl: config.qrCodeImageUrl,
    qrCodeText: config.qrCodeText,
    usageLimitMonthly: config.usageLimitMonthly,
    lastConnectedAt: config.lastConnectedAt,
    lastDisconnectedAt: config.lastDisconnectedAt,
    lastSyncAt: config.lastSyncAt,
  }
}

class WhatsAppService implements IWhatsAppService {
  async createConfig(input: CreateWhatsAppConfigInput): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (existing) {
      throw new Error("Configuração já existe para este time")
    }

    const instanceName = `team_${input.teamId.replace(/-/g, "").slice(0, 16)}`
    const webhookSecret = generateWebhookSecret()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error("[WhatsAppService] NEXT_PUBLIC_APP_URL is not set")

    const webhookUrl = `${appUrl}/api/webhooks/whatsapp/evolution/${webhookSecret}`

    console.info("[WhatsAppService][createConfig] Creating instance", instanceName)

    const evoResult = await evoApiService.createInstance({
      instanceName,
      webhookUrl,
      hostBaseUrl: input.hostBaseUrl,
    })

    const config = await whatsAppRepository.createConfig({
      team: { connect: { id: input.teamId } },
      instanceName: evoResult.instanceName,
      instanceId: evoResult.instanceId ?? undefined,
      webhookSecret,
      hostBaseUrl: input.hostBaseUrl ?? null,
      usageLimitMonthly: input.usageLimitMonthly ?? 2000,
      status: evoResult.status === "open" ? "CONNECTED" : evoResult.status === "connecting" ? "QR_READY" : "PENDING",
      qrCodeText: evoResult.qrCode?.text ?? null,
      qrCodeImageUrl: evoResult.qrCode?.base64 ? `data:image/png;base64,${evoResult.qrCode.base64}` : null,
      createdBy: { connect: { id: input.profileId } },
      updatedBy: { connect: { id: input.profileId } },
    })

    return toConfigOutput(config)
  }

  async getConfig(teamId: string): Promise<ConfigOutput | null> {
    const config = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!config) return null
    return toConfigOutput(config)
  }

  async reconnect(teamId: string, profileId: string): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!existing) {
      throw new Error("Configuração não encontrada")
    }

    console.info("[WhatsAppService][reconnect] Fetching QR code for", existing.instanceName)

    const qr = await evoApiService.getQrCode(existing.instanceName, existing.hostBaseUrl ?? undefined)

    const updated = await whatsAppRepository.updateConfig(existing.id, {
      status: "QR_READY",
      qrCodeText: qr.text,
      qrCodeImageUrl: `data:image/png;base64,${qr.base64}`,
      updatedBy: { connect: { id: profileId } },
    })

    return toConfigOutput(updated)
  }

  async disconnect(teamId: string, profileId: string): Promise<ConfigOutput> {
    const existing = await whatsAppRepository.findConfigByTeamId(teamId)
    if (!existing) {
      throw new Error("Configuração não encontrada")
    }

    console.info("[WhatsAppService][disconnect] Disconnecting instance", existing.instanceName)

    await evoApiService.disconnectInstance(existing.instanceName, existing.hostBaseUrl ?? undefined)

    const updated = await whatsAppRepository.updateConfig(existing.id, {
      status: "DISCONNECTED",
      lastDisconnectedAt: new Date(),
      updatedBy: { connect: { id: profileId } },
    })

    return toConfigOutput(updated)
  }

  async sendMessage(input: SendMessageInput): Promise<{ messageId: string }> {
    const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
    if (!config) {
      throw new Error("Configuração não encontrada")
    }
    if (config.status !== "CONNECTED") {
      throw new Error("WhatsApp não está conectado")
    }

    const conversation = await whatsAppRepository.findConversationById(input.conversationId)

    if (!conversation) {
      throw new Error("Conversa não encontrada")
    }

    const recipientPhone = normalizePhone(conversation.contactPhone)

    console.info("[WhatsAppService][sendMessage] Sending message to", recipientPhone)

    const evoResult = await evoApiService.sendTextMessage({
      instanceName: config.instanceName,
      recipientPhone,
      text: input.contentText,
      hostBaseUrl: config.hostBaseUrl ?? undefined,
    })

    const now = new Date()
    const periodKey = buildPeriodKey(now)

    const message = await whatsAppRepository.createMessage({
      conversation: { connect: { id: input.conversationId } },
      team: { connect: { id: input.teamId } },
      config: { connect: { id: config.id } },
      ...(conversation.leadId ? { lead: { connect: { id: conversation.leadId } } } : {}),
      providerMessageId: evoResult.providerMessageId,
      direction: "OUTBOUND",
      messageType: "TEXT",
      status: "SENT",
      contentText: input.contentText,
      recipientPhone,
      sentByProfile: { connect: { id: input.sentByProfileId } },
      sentAt: now,
      rawPayload: {},
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
      lastMessagePreview: input.contentText.slice(0, 100),
    })

    return { messageId: message.id }
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
