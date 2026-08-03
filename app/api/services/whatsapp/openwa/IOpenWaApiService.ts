export interface IOpenWaApiService {
  startSession(instanceName: string, webhookUrl: string): Promise<void>
  getSessionStatus(instanceName: string): Promise<OpenWaSessionStatus>
  deleteSession(instanceName: string): Promise<void>
  sendText(instanceName: string, to: string, text: string): Promise<OpenWaSentMessage>
  sendMedia(instanceName: string, params: OpenWaMediaParams): Promise<OpenWaSentMessage>
  markChatSeen(instanceName: string, chatId: string): Promise<void>
  fetchChats(instanceName: string): Promise<OpenWaChatSummary[]>
  fetchContacts(instanceName: string): Promise<OpenWaContactSummary[]>
  fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: string
  }): Promise<OpenWaHistoryMessage[]>
  fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<OpenWaGroupParticipant[]>
}

export type OpenWaSessionStatus =
  | { status: "INITIALIZING" }
  | { status: "QR_READY"; qr: string }
  | { status: "CONNECTED" }
  | { status: "DISCONNECTED" }

export interface OpenWaSentMessage {
  messageId: string
}

export interface OpenWaMediaParams {
  to: string
  base64: string
  mimetype: string
  filename?: string
  caption?: string
}

export interface OpenWaChatSummary {
  remoteJid: string
  pushName: string | null
  subject: string | null
  profilePicUrl: string | null
  updatedAt: string | null
}

export interface OpenWaContactSummary {
  remoteJid: string
  pushName: string | null
  phoneNumber: string | null
}

export interface OpenWaHistoryMessage {
  providerMessageId: string
  remoteJid: string
  fromMe: boolean
  messageTimestamp: string
  body: string | null
  hasMedia: boolean
  type: string
  senderDisplayName: string | null
}

export interface OpenWaGroupParticipant {
  remoteJid: string
  pushName: string | null
  phoneNumber: string | null
  admin: string | null
}
