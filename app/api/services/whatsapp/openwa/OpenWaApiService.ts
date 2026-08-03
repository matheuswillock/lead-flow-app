import type {
  IOpenWaApiService,
  OpenWaChatSummary,
  OpenWaContactSummary,
  OpenWaGroupParticipant,
  OpenWaHistoryMessage,
  OpenWaMediaParams,
  OpenWaSentMessage,
  OpenWaSessionStatus,
} from "./IOpenWaApiService"

function getBaseUrl(): string {
  const url = process.env.OPENWA_API_URL
  if (!url) throw new Error("[OpenWaApiService] OPENWA_API_URL is not set")
  return url.replace(/\/$/, "")
}

function getApiKey(): string {
  const key = process.env.OPENWA_API_KEY
  if (!key) throw new Error("[OpenWaApiService] OPENWA_API_KEY is not set")
  return key
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  }
}

async function fetchOpenWa<T>(
  method: string,
  url: string,
  apiKey: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: buildHeaders(apiKey),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const path = url.replace(/^https?:\/\/[^/]+/, "")
    throw new Error(`[OpenWaApiService] ${method} ${path} → ${response.status}`)
  }

  return response.json() as Promise<T>
}

export class OpenWaApiService implements IOpenWaApiService {
  async startSession(instanceName: string, webhookUrl: string): Promise<void> {
    await fetchOpenWa<unknown>(
      "POST",
      `${getBaseUrl()}/session/start/${instanceName}`,
      getApiKey(),
      { webhookUrl }
    )
  }

  async getSessionStatus(instanceName: string): Promise<OpenWaSessionStatus> {
    const data = await fetchOpenWa<{ status: string; qr?: string }>(
      "GET",
      `${getBaseUrl()}/session/status/${instanceName}`,
      getApiKey()
    )

    if (data.status === "QR_READY") {
      return { status: "QR_READY", qr: data.qr ?? "" }
    }

    return { status: data.status } as OpenWaSessionStatus
  }

  async deleteSession(instanceName: string): Promise<void> {
    await fetchOpenWa<unknown>(
      "DELETE",
      `${getBaseUrl()}/session/delete/${instanceName}`,
      getApiKey()
    )
  }

  async sendText(instanceName: string, to: string, text: string): Promise<OpenWaSentMessage> {
    return fetchOpenWa<OpenWaSentMessage>(
      "POST",
      `${getBaseUrl()}/client/sendMessage/${instanceName}`,
      getApiKey(),
      { to, text }
    )
  }

  async sendMedia(instanceName: string, params: OpenWaMediaParams): Promise<OpenWaSentMessage> {
    return fetchOpenWa<OpenWaSentMessage>(
      "POST",
      `${getBaseUrl()}/client/sendMedia/${instanceName}`,
      getApiKey(),
      params
    )
  }

  async markChatSeen(instanceName: string, chatId: string): Promise<void> {
    await fetchOpenWa<unknown>(
      "POST",
      `${getBaseUrl()}/client/markChatSeen/${instanceName}`,
      getApiKey(),
      { chatId }
    )
  }

  async fetchChats(instanceName: string): Promise<OpenWaChatSummary[]> {
    const data = await fetchOpenWa<{ chats: OpenWaChatSummary[] }>(
      "GET",
      `${getBaseUrl()}/client/chats/${instanceName}`,
      getApiKey()
    )
    return data.chats
  }

  async fetchContacts(instanceName: string): Promise<OpenWaContactSummary[]> {
    const data = await fetchOpenWa<{ contacts: OpenWaContactSummary[] }>(
      "GET",
      `${getBaseUrl()}/client/contacts/${instanceName}`,
      getApiKey()
    )
    return data.contacts
  }

  async fetchMessagesSince(params: {
    instanceName: string
    remoteJid: string
    since: string
  }): Promise<OpenWaHistoryMessage[]> {
    const query = new URLSearchParams({
      remoteJid: params.remoteJid,
      since: params.since,
    })
    const data = await fetchOpenWa<{ messages: OpenWaHistoryMessage[] }>(
      "GET",
      `${getBaseUrl()}/client/messages/${params.instanceName}?${query.toString()}`,
      getApiKey()
    )
    return data.messages
  }

  async fetchGroupParticipants(params: {
    instanceName: string
    groupJid: string
  }): Promise<OpenWaGroupParticipant[]> {
    const query = new URLSearchParams({ groupJid: params.groupJid })
    const data = await fetchOpenWa<{ participants: OpenWaGroupParticipant[] }>(
      "GET",
      `${getBaseUrl()}/client/groupParticipants/${params.instanceName}?${query.toString()}`,
      getApiKey()
    )
    return data.participants
  }
}

export const openWaApiService = new OpenWaApiService()
