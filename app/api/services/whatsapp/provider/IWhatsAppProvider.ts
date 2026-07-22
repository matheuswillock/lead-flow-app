// Contrato vendor-neutral do provedor de WhatsApp (WHATSAPP_SPEC.md, Estágio 5 / D4).
// Camadas de domínio (WhatsAppService, use cases) dependem apenas desta
// interface; Evolution API é uma implementação em EvolutionWhatsAppProvider.
// Um segundo provedor (ex.: Meta Cloud API) implementa esta interface sem
// tocar no domínio.

import type { WhatsAppMessageType } from "@prisma/client"

export type WhatsAppProviderConnectionState = "open" | "close" | "connecting"

export interface WhatsAppProviderQrCode {
  text: string
  base64: string
}

export interface WhatsAppProviderConnectResult {
  instanceName: string
  instanceId: string | null
  status: WhatsAppProviderConnectionState
  qrCode: WhatsAppProviderQrCode | null
  adopted: boolean
}

export interface WhatsAppProviderConnectionInfo {
  instanceName: string
  state: WhatsAppProviderConnectionState
}

export interface WhatsAppProviderInstanceInfo {
  instanceName: string
  owner: string | null
  profileName: string | null
}

export interface WhatsAppProviderChatSummary {
  remoteJid: string
  pushName: string | null
  subject: string | null
  profilePicUrl: string | null
  updatedAt: Date | null
}

export interface WhatsAppProviderMessageContent {
  messageType: WhatsAppMessageType
  contentText: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaFileName: string | null
  caption: string | null
  linkPreview: {
    title: string | null
    description: string | null
    imageUrl: string | null
    url: string | null
  } | null
}

export interface WhatsAppProviderHistoryMessage {
  providerMessageId: string
  remoteJid: string
  fromMe: boolean
  messageTimestamp: Date
  content: WhatsAppProviderMessageContent
  senderDisplayName: string | null
  rawPayload: unknown
}

export interface WhatsAppProviderSendResult {
  providerMessageId: string
  status: string
  messageKey?: Record<string, unknown>
}

export interface WhatsAppProviderContact {
  remoteJid: string
  pushName: string | null
  phoneNumber: string | null
}

export interface WhatsAppProviderGroupParticipant extends WhatsAppProviderContact {
  admin: string | null
}

export interface WhatsAppProviderMediaContent {
  base64: string
  mimeType: string
}

export interface WhatsAppProviderReadMessage {
  remoteJid: string
  fromMe: boolean
  id: string
}

export type WhatsAppProviderMediaType = "image" | "document" | "audio" | "video"

export interface IWhatsAppProvider {
  connectInstance(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderConnectResult>

  setWebhook(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<void>

  getQrCode(instanceName: string, hostBaseUrl?: string): Promise<WhatsAppProviderQrCode>

  getConnectionState(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderConnectionInfo>

  getInstanceInfo(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<WhatsAppProviderInstanceInfo | null>

  fetchChats(instanceName: string, hostBaseUrl?: string): Promise<WhatsAppProviderChatSummary[]>

  fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: Date
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderHistoryMessage[]>

  fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
    hostBaseUrl?: string
  }): Promise<string | null>

  sendText(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderSendResult>

  sendMedia(params: {
    instanceName: string
    recipientJid: string
    mediatype: WhatsAppProviderMediaType
    mimeType: string
    fileName: string
    base64: string
    caption?: string
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderSendResult>

  resolveMediaBase64(params: {
    instanceName: string
    messageKey: Record<string, unknown>
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderMediaContent | null>

  fetchContacts(instanceName: string, hostBaseUrl?: string): Promise<WhatsAppProviderContact[]>

  fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
    hostBaseUrl?: string
  }): Promise<WhatsAppProviderGroupParticipant[]>

  markMessagesAsRead(params: {
    instanceName: string
    readMessages: WhatsAppProviderReadMessage[]
    hostBaseUrl?: string
  }): Promise<void>

  disconnect(instanceName: string, hostBaseUrl?: string): Promise<void>
}
