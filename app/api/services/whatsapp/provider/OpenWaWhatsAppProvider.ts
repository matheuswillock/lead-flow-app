import type { IOpenWaApiService } from "../openwa/IOpenWaApiService"
import { openWaApiService } from "../openwa/OpenWaApiService"
import { parseMessageContent } from "../parseMessageContent"
import {
  WhatsAppProviderCapabilityError,
  type IWhatsAppProvider,
  type WhatsAppMessageActionCapabilities,
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
 * Adapter OpenWA Gateway → IWhatsAppProvider.
 * Métodos sem endpoint no Gateway MVP lançam WhatsAppProviderCapabilityError.
 */
export class OpenWaWhatsAppProvider implements IWhatsAppProvider {
  constructor(private readonly openwa: IOpenWaApiService = openWaApiService) {}

  async connectInstance(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<WhatsAppProviderConnectResult> {
    await this.openwa.startSession(params.instanceName, params.webhookUrl)
    return {
      instanceName: params.instanceName,
      instanceId: null,
      status: "connecting",
      qrCode: null,
      adopted: false,
    }
  }

  async setWebhook(_params: {
    instanceName: string
    webhookUrl: string
  }): Promise<void> {
    throw new WhatsAppProviderCapabilityError("setWebhook")
  }

  async getQrCode(instanceName: string): Promise<WhatsAppProviderQrCode> {
    const status = await this.openwa.getSessionStatus(instanceName)
    if (status.status !== "QR_READY" || !status.qr) {
      throw new Error(`[OpenWaWhatsAppProvider] QR não disponível (status=${status.status})`)
    }
    return { text: status.qr, base64: status.qr }
  }

  async getConnectionState(instanceName: string): Promise<WhatsAppProviderConnectionInfo> {
    const status = await this.openwa.getSessionStatus(instanceName)
    const state =
      status.status === "CONNECTED"
        ? "open"
        : status.status === "INITIALIZING" || status.status === "QR_READY"
          ? "connecting"
          : "close"
    return { instanceName, state }
  }

  async getInstanceInfo(instanceName: string): Promise<WhatsAppProviderInstanceInfo | null> {
    const status = await this.openwa.getSessionStatus(instanceName)
    if (status.status === "DISCONNECTED") return null
    return {
      instanceName,
      owner: null,
      profileName: null,
    }
  }

  async fetchChats(instanceName: string): Promise<WhatsAppProviderChatSummary[]> {
    const chats = await this.openwa.fetchChats(instanceName)
    return chats.map((chat) => ({
      remoteJid: chat.remoteJid,
      pushName: chat.pushName,
      subject: chat.subject,
      profilePicUrl: chat.profilePicUrl,
      updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : null,
    }))
  }

  async fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: Date
  }): Promise<WhatsAppProviderHistoryMessage[]> {
    const messages = await this.openwa.fetchMessagesSince({
      instanceName: params.instanceName,
      remoteJid: params.remoteJid,
      since: params.since.toISOString(),
    })

    return messages.map((item) => ({
      providerMessageId: item.providerMessageId,
      remoteJid: item.remoteJid,
      fromMe: item.fromMe,
      messageTimestamp: new Date(item.messageTimestamp),
      content: parseMessageContent(
        item.body
          ? { conversation: item.body }
          : item.hasMedia
            ? { imageMessage: { mimetype: "application/octet-stream" } }
            : {}
      ),
      senderDisplayName: item.senderDisplayName,
      rawPayload: item,
    }))
  }

  async fetchProfilePictureUrl(_params: {
    instanceName: string
    remoteJid: string
  }): Promise<string | null> {
    return null
  }

  async sendText(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    quoted?: WhatsAppProviderQuotedMessage
  }): Promise<WhatsAppProviderSendResult> {
    const result = await this.openwa.sendText(
      params.instanceName,
      params.recipientJid,
      params.text
    )
    return {
      providerMessageId: result.messageId,
      status: "PENDING",
      messageKey: { id: result.messageId },
    }
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
    const result = await this.openwa.sendMedia(params.instanceName, {
      to: params.recipientJid,
      base64: params.base64,
      mimetype: params.mimeType,
      filename: params.fileName,
      caption: params.caption,
    })
    return {
      providerMessageId: result.messageId,
      status: "PENDING",
      messageKey: { id: result.messageId },
    }
  }

  getMessageActionCapabilities(): WhatsAppMessageActionCapabilities {
    return {
      reply: true,
      forward: true,
      react: false,
      deleteForEveryone: false,
    }
  }

  async resolveMediaBase64(_params: {
    instanceName: string
    messageKey: Record<string, unknown>
  }): Promise<WhatsAppProviderMediaContent | null> {
    // OpenWA inclui base64 no payload do webhook — ingest não precisa baixar.
    return null
  }

  async fetchContacts(instanceName: string): Promise<WhatsAppProviderContact[]> {
    return this.openwa.fetchContacts(instanceName)
  }

  async fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<WhatsAppProviderGroupParticipant[]> {
    return this.openwa.fetchGroupParticipants(params)
  }

  async markMessagesAsRead(params: {
    instanceName: string
    readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  }): Promise<void> {
    const chatId = params.readMessages[0]?.remoteJid
    if (!chatId) return
    await this.openwa.markChatSeen(params.instanceName, chatId)
  }

  async disconnect(instanceName: string): Promise<void> {
    await this.openwa.deleteSession(instanceName)
  }
}

export const openWaWhatsAppProvider = new OpenWaWhatsAppProvider()
