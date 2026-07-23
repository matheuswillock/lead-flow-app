export interface EvoCreateInstanceResult {
  instanceName: string
  instanceId: string | null
  status: 'open' | 'close' | 'connecting'
  qrCode: { text: string; base64: string } | null
}

export interface EvoConnectionState {
  instanceName: string
  state: 'open' | 'close' | 'connecting'
}

export interface EvoInstanceInfo {
  instanceName: string
  owner: string | null
  profileName: string | null
}

export interface EvoChatSummary {
  remoteJid: string
  pushName: string | null
  subject: string | null
  profilePicUrl: string | null
  updatedAt: Date | null
}

export interface EvoHistoryMessage {
  providerMessageId: string
  remoteJid: string
  fromMe: boolean
  messageTimestamp: Date
  messageBody: unknown
  rawRecord: unknown
}

export interface EvoSendTextResult {
  providerMessageId: string
  status: string
  messageKey?: Record<string, unknown>
}

export const WHATSAPP_EVO_WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "PRESENCE_UPDATE",
] as const

export interface IEvoApiService {
  createInstance(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<EvoCreateInstanceResult>

  adoptOrCreateInstance(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<EvoCreateInstanceResult & { adopted: boolean }>

  setWebhook(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<void>

  getQrCode(instanceName: string): Promise<{ text: string; base64: string }>

  getConnectionState(instanceName: string): Promise<EvoConnectionState>

  fetchInstance(instanceName: string): Promise<EvoInstanceInfo | null>

  findChats(instanceName: string): Promise<EvoChatSummary[]>

  findMessages(params: {
    instanceName: string
    remoteJid: string
    since: Date
  }): Promise<EvoHistoryMessage[]>

  fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
  }): Promise<string | null>

  sendTextMessage(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
  }): Promise<EvoSendTextResult>

  sendMediaMessage(params: {
    instanceName: string
    recipientJid: string
    mediatype: 'image' | 'document' | 'audio' | 'video'
    mimeType: string
    fileName: string
    base64: string
    caption?: string
  }): Promise<EvoSendTextResult>

  getBase64FromMediaMessage(params: {
    instanceName: string
    messageKey: Record<string, unknown>
  }): Promise<{ base64: string; mimeType: string } | null>

  findContacts(instanceName: string): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null }>>

  findGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null; admin: string | null }>>

  markMessagesAsRead(params: {
    instanceName: string
    readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  }): Promise<void>

  disconnectInstance(instanceName: string): Promise<void>

  deleteInstance(instanceName: string): Promise<void>
}
