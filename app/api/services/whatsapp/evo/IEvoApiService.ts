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
  messagePayload: unknown
}

export interface EvoSendTextResult {
  providerMessageId: string
  status: string
  messageKey?: Record<string, unknown>
}

export interface IEvoApiService {
  createInstance(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<EvoCreateInstanceResult>

  getQrCode(instanceName: string, hostBaseUrl?: string): Promise<{ text: string; base64: string }>

  getConnectionState(instanceName: string, hostBaseUrl?: string): Promise<EvoConnectionState>

  fetchInstance(instanceName: string, hostBaseUrl?: string): Promise<EvoInstanceInfo | null>

  findChats(instanceName: string, hostBaseUrl?: string): Promise<EvoChatSummary[]>

  findMessages(params: {
    instanceName: string
    remoteJid: string
    since: Date
    hostBaseUrl?: string
  }): Promise<EvoHistoryMessage[]>

  fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
    hostBaseUrl?: string
  }): Promise<string | null>

  sendTextMessage(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult>

  sendMediaMessage(params: {
    instanceName: string
    recipientJid: string
    mediatype: 'image' | 'document' | 'audio' | 'video'
    mimeType: string
    fileName: string
    base64: string
    caption?: string
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult>

  getBase64FromMediaMessage(params: {
    instanceName: string
    messageKey: Record<string, unknown>
    hostBaseUrl?: string
  }): Promise<{ base64: string; mimeType: string } | null>

  findContacts(instanceName: string, hostBaseUrl?: string): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null }>>

  findGroupParticipants(params: {
    instanceName: string
    groupJid: string
    hostBaseUrl?: string
  }): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null; admin: string | null }>>

  disconnectInstance(instanceName: string, hostBaseUrl?: string): Promise<void>

  deleteInstance(instanceName: string, hostBaseUrl?: string): Promise<void>
}
