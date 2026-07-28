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
  quotedProviderMessageId: string | null
  linkPreview: {
    title: string | null
    description: string | null
    imageUrl: string | null
    url: string | null
  } | null
}

export interface WhatsAppProviderQuotedMessage {
  providerMessageId: string
  fromMe?: boolean
  remoteJid?: string
}

export interface WhatsAppMessageActionCapabilities {
  reply: boolean
  forward: boolean
  react: boolean
  deleteForEveryone: boolean
}

export interface WhatsAppProviderActionResult {
  providerActionId: string | null
  status: string
}

export class WhatsAppProviderCapabilityError extends Error {
  readonly code = "CAPABILITY_UNAVAILABLE" as const

  constructor(capability: string) {
    super(`Capability unavailable: ${capability}`)
    this.name = "WhatsAppProviderCapabilityError"
  }
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
  }): Promise<WhatsAppProviderConnectResult>

  setWebhook(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<void>

  getQrCode(instanceName: string): Promise<WhatsAppProviderQrCode>

  getConnectionState(
    instanceName: string
  ): Promise<WhatsAppProviderConnectionInfo>

  getInstanceInfo(
    instanceName: string
  ): Promise<WhatsAppProviderInstanceInfo | null>

  fetchChats(instanceName: string): Promise<WhatsAppProviderChatSummary[]>

  fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: Date
  }): Promise<WhatsAppProviderHistoryMessage[]>

  fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
  }): Promise<string | null>

  sendText(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    quoted?: WhatsAppProviderQuotedMessage
  }): Promise<WhatsAppProviderSendResult>

  sendMedia(params: {
    instanceName: string
    recipientJid: string
    mediatype: WhatsAppProviderMediaType
    mimeType: string
    fileName: string
    base64: string
    caption?: string
    quoted?: WhatsAppProviderQuotedMessage
  }): Promise<WhatsAppProviderSendResult>

  getMessageActionCapabilities(): WhatsAppMessageActionCapabilities

  reactToMessage?(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
    emoji: string
  }): Promise<WhatsAppProviderActionResult>

  unreactToMessage?(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
    emoji: string
  }): Promise<WhatsAppProviderActionResult>

  deleteForEveryone?(params: {
    instanceName: string
    remoteJid: string
    providerMessageId: string
    fromMe: boolean
  }): Promise<WhatsAppProviderActionResult>

  resolveMediaBase64(params: {
    instanceName: string
    messageKey: Record<string, unknown>
  }): Promise<WhatsAppProviderMediaContent | null>

  fetchContacts(instanceName: string): Promise<WhatsAppProviderContact[]>

  fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<WhatsAppProviderGroupParticipant[]>

  markMessagesAsRead(params: {
    instanceName: string
    readMessages: WhatsAppProviderReadMessage[]
  }): Promise<void>

  disconnect(instanceName: string): Promise<void>
}
