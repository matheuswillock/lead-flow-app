import type { IEvoApiService, EvoHistoryMessage } from "../evo/IEvoApiService"
import { evoApiService } from "../evo/EvoApiService"
import { parseEvoMessageContent } from "../evo/parseEvoMessageContent"
import { sanitizeDbText, stripHtmlTags } from "@/lib/whatsapp/sanitize-db-text"
import {
  WhatsAppProviderCapabilityError,
  type IWhatsAppProvider,
  type WhatsAppMessageActionCapabilities,
  type WhatsAppProviderActionResult,
  type WhatsAppProviderChatSummary,
  type WhatsAppProviderConnectResult,
  type WhatsAppProviderConnectionInfo,
  type WhatsAppProviderContact,
  type WhatsAppProviderGroupParticipant,
  type WhatsAppProviderHistoryMessage,
  type WhatsAppProviderInstanceInfo,
  type WhatsAppProviderMediaContent,
  type WhatsAppProviderMediaType,
  type WhatsAppProviderQrCode,
  type WhatsAppProviderQuotedMessage,
  type WhatsAppProviderSendResult,
} from "./IWhatsAppProvider"

/**
 * Adapter Evolution API → contrato vendor-neutral IWhatsAppProvider.
 * Este é o único ponto do domínio produto autorizado a importar
 * EvoApiService; qualquer novo uso do vendor entra por aqui.
 * O par inbound (parse de webhook) permanece em ProcessEvoWebhookUseCase.
 */
export class EvolutionWhatsAppProvider implements IWhatsAppProvider {
  constructor(private readonly evo: IEvoApiService = evoApiService) {}

  async connectInstance(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<WhatsAppProviderConnectResult> {
    const result = await this.evo.adoptOrCreateInstance(params)
    return {
      instanceName: result.instanceName,
      instanceId: result.instanceId,
      status: result.status,
      qrCode: result.qrCode,
      adopted: result.adopted,
    }
  }

  async setWebhook(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<void> {
    await this.evo.setWebhook(params)
  }

  async getQrCode(instanceName: string): Promise<WhatsAppProviderQrCode> {
    return this.evo.getQrCode(instanceName)
  }

  async getConnectionState(
    instanceName: string
  ): Promise<WhatsAppProviderConnectionInfo> {
    return this.evo.getConnectionState(instanceName)
  }

  async getInstanceInfo(
    instanceName: string
  ): Promise<WhatsAppProviderInstanceInfo | null> {
    return this.evo.fetchInstance(instanceName)
  }

  async fetchChats(
    instanceName: string
  ): Promise<WhatsAppProviderChatSummary[]> {
    return this.evo.findChats(instanceName)
  }

  async fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: Date
  }): Promise<WhatsAppProviderHistoryMessage[]> {
    const messages = await this.evo.findMessages(params)
    return messages.map((item) => this.normalizeHistoryMessage(item))
  }

  private normalizeHistoryMessage(item: EvoHistoryMessage): WhatsAppProviderHistoryMessage {
    const rawRecord =
      typeof item.rawRecord === "object" && item.rawRecord !== null
        ? (item.rawRecord as Record<string, unknown>)
        : null

    const pushName = rawRecord?.pushName
    const senderDisplayName =
      typeof pushName === "string"
        ? (stripHtmlTags(sanitizeDbText(pushName)) ?? null)
        : null

    return {
      providerMessageId: item.providerMessageId,
      remoteJid: item.remoteJid,
      fromMe: item.fromMe,
      messageTimestamp: item.messageTimestamp,
      content: parseEvoMessageContent(item.messageBody),
      senderDisplayName,
      rawPayload: item.rawRecord,
    }
  }

  async fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
  }): Promise<string | null> {
    return this.evo.fetchProfilePictureUrl(params)
  }

  async sendText(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    quoted?: WhatsAppProviderQuotedMessage
  }): Promise<WhatsAppProviderSendResult> {
    return this.evo.sendTextMessage(params)
  }

  async sendMedia(params: {
    instanceName: string
    recipientJid: string
    mediatype: WhatsAppProviderMediaType
    mimeType: string
    fileName: string
    base64: string
    caption?: string
    quoted?: WhatsAppProviderQuotedMessage
  }): Promise<WhatsAppProviderSendResult> {
    return this.evo.sendMediaMessage(params)
  }

  getMessageActionCapabilities(): WhatsAppMessageActionCapabilities {
    return {
      reply: true,
      forward: true,
      react: true,
      deleteForEveryone: true,
    }
  }

  async reactToMessage(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
    emoji: string
  }): Promise<WhatsAppProviderActionResult> {
    await this.evo.sendReaction({
      instanceName: params.instanceName,
      key: { remoteJid: params.remoteJid, fromMe: params.fromMe, id: params.providerMessageId },
      reaction: params.emoji,
    })
    return { providerActionId: null, status: "ok" }
  }

  async unreactToMessage(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
    emoji: string
  }): Promise<WhatsAppProviderActionResult> {
    await this.evo.sendReaction({
      instanceName: params.instanceName,
      key: { remoteJid: params.remoteJid, fromMe: params.fromMe, id: params.providerMessageId },
      reaction: "",
    })
    return { providerActionId: null, status: "ok" }
  }

  async deleteForEveryone(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
  }): Promise<WhatsAppProviderActionResult> {
    await this.evo.deleteMessage({
      instanceName: params.instanceName,
      remoteJid: params.remoteJid,
      messageId: params.providerMessageId,
      fromMe: params.fromMe,
    })
    return { providerActionId: null, status: "ok" }
  }

  async resolveMediaBase64(params: {
    instanceName: string
    messageKey: Record<string, unknown>
  }): Promise<WhatsAppProviderMediaContent | null> {
    return this.evo.getBase64FromMediaMessage(params)
  }

  async fetchContacts(
    instanceName: string
  ): Promise<WhatsAppProviderContact[]> {
    return this.evo.findContacts(instanceName)
  }

  async fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<WhatsAppProviderGroupParticipant[]> {
    return this.evo.findGroupParticipants(params)
  }

  async markMessagesAsRead(params: {
    instanceName: string
    readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  }): Promise<void> {
    return this.evo.markMessagesAsRead(params)
  }

  async disconnect(instanceName: string): Promise<void> {
    return this.evo.disconnectInstance(instanceName)
  }
}

export const evolutionWhatsAppProvider = new EvolutionWhatsAppProvider()
