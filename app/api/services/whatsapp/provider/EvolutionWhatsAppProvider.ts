import type { IEvoApiService, EvoHistoryMessage } from "../evo/IEvoApiService"
import { evoApiService } from "../evo/EvoApiService"
import { parseEvoMessageContent } from "../evo/parseEvoMessageContent"
import { sanitizeDbText, stripHtmlTags } from "@/lib/whatsapp/sanitize-db-text"
import type {
  IWhatsAppProvider,
  WhatsAppProviderChatSummary,
  WhatsAppProviderConnectResult,
  WhatsAppProviderConnectionInfo,
  WhatsAppProviderContact,
  WhatsAppProviderGroupParticipant,
  WhatsAppProviderHistoryMessage,
  WhatsAppProviderInstanceInfo,
  WhatsAppProviderMediaContent,
  WhatsAppProviderMediaType,
  WhatsAppProviderQrCode,
  WhatsAppProviderSendResult,
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
    hostBaseUrl?: string
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

  async getQrCode(instanceName: string, hostBaseUrl?: string): Promise<WhatsAppProviderQrCode> {
    return this.evo.getQrCode(instanceName, hostBaseUrl)
  }

  async getConnectionState(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderConnectionInfo> {
    return this.evo.getConnectionState(instanceName, hostBaseUrl)
  }

  async getInstanceInfo(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderInstanceInfo | null> {
    return this.evo.fetchInstance(instanceName, hostBaseUrl)
  }

  async fetchChats(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderChatSummary[]> {
    return this.evo.findChats(instanceName, hostBaseUrl)
  }

  async fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: Date
    hostBaseUrl?: string
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
    hostBaseUrl?: string
  }): Promise<string | null> {
    return this.evo.fetchProfilePictureUrl(params)
  }

  async sendText(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    hostBaseUrl?: string
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
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderSendResult> {
    return this.evo.sendMediaMessage(params)
  }

  async resolveMediaBase64(params: {
    instanceName: string
    messageKey: Record<string, unknown>
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderMediaContent | null> {
    return this.evo.getBase64FromMediaMessage(params)
  }

  async fetchContacts(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderContact[]> {
    return this.evo.findContacts(instanceName, hostBaseUrl)
  }

  async fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderGroupParticipant[]> {
    return this.evo.findGroupParticipants(params)
  }

  async markMessagesAsRead(params: {
    instanceName: string
    readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
    hostBaseUrl?: string
  }): Promise<void> {
    return this.evo.markMessagesAsRead(params)
  }

  async disconnect(instanceName: string, hostBaseUrl?: string): Promise<void> {
    return this.evo.disconnectInstance(instanceName, hostBaseUrl)
  }
}

export const evolutionWhatsAppProvider = new EvolutionWhatsAppProvider()
