import type {
  EvoChatSummary,
  EvoConnectionState,
  EvoCreateInstanceResult,
  EvoHistoryMessage,
  EvoInstanceInfo,
  EvoSendTextResult,
  IEvoApiService,
} from "./IEvoApiService"
import { WHATSAPP_EVO_WEBHOOK_EVENTS } from "./IEvoApiService"
import { normalizePhone, normalizeRemoteJid } from "../phoneUtils"

function getBaseUrl(hostBaseUrl?: string): string {
  if (hostBaseUrl) return hostBaseUrl.replace(/\/$/, "")
  const envUrl = process.env.EVO_API_BASE_URL
  if (!envUrl) throw new Error("[EvoApiService] EVO_API_BASE_URL is not set")
  return envUrl.replace(/\/$/, "")
}

function getApiKey(): string {
  const key = process.env.EVO_API_KEY
  if (!key) throw new Error("[EvoApiService] EVO_API_KEY is not set")
  return key
}

async function fetchEvo<T>(
  url: string,
  options: RequestInit,
  label: string
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (error) {
    console.error(`[EvoApiService][${label}] Network error`, error)
    throw new Error(`[EvoApiService][${label}] Network request failed: ${String(error)}`)
  }

  if (!response.ok) {
    let body = ""
    try {
      body = await response.text()
    } catch {
      // ignore body read errors
    }
    console.error(`[EvoApiService][${label}] HTTP ${response.status}`, body)
    throw new Error(
      `[EvoApiService][${label}] HTTP ${response.status}: ${body}`
    )
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    console.error(`[EvoApiService][${label}] Failed to parse JSON response`, error)
    throw new Error(`[EvoApiService][${label}] Invalid JSON response`)
  }
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  }
}

export function isInstanceNameAlreadyInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return message.includes("403") && message.includes("already in use")
}

function buildWebhookPayload(webhookUrl: string) {
  return {
    enabled: true,
    url: webhookUrl,
    events: [...WHATSAPP_EVO_WEBHOOK_EVENTS],
  }
}

interface EvoCreateInstanceResponse {
  instance?: {
    instanceName?: string
    instanceId?: string
    status?: string
  }
  hash?: {
    apikey?: string
  }
  qrcode?: {
    pairingCode?: string
    code?: string
    base64?: string
  }
}

interface EvoConnectionStateResponse {
  instance?: {
    instanceName?: string
    state?: string
  }
}

interface EvoSendTextResponse {
  key?: {
    id?: string
    remoteJid?: string
    fromMe?: boolean
  }
  status?: string
  message?: {
    conversation?: string
  }
}

function parseEvoMessageKey(
  key: EvoSendTextResponse["key"],
  fallback: { remoteJid: string; providerMessageId: string }
): Record<string, unknown> {
  return {
    remoteJid: key?.remoteJid ?? fallback.remoteJid,
    fromMe: key?.fromMe ?? true,
    id: key?.id ?? fallback.providerMessageId,
  }
}

interface EvoQrCodeResponse {
  pairingCode?: string
  code?: string
  base64?: string
}

interface EvoFetchInstancesResponse {
  instance?: {
    instanceName?: string
    owner?: string
    profileName?: string
  }
}

type EvoFetchInstancesListResponse = Array<{
  name?: string
  instanceName?: string
  owner?: string
  profileName?: string
}>

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function extractChatArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }
  const record = asRecord(data)
  if (!record) return []
  if (Array.isArray(record.chats)) {
    return record.chats.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }
  return []
}

function extractMessageRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }
  const record = asRecord(data)
  if (!record) return []
  const messages = asRecord(record.messages)
  if (messages && Array.isArray(messages.records)) {
    return messages.records.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }
  if (Array.isArray(record.records)) {
    return record.records.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
  }
  return []
}

function parseUnixTimestamp(value: unknown): Date | null {
  if (typeof value === "number") return new Date(value > 1_000_000_000_000 ? value : value * 1000)
  if (typeof value === "string") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return new Date(parsed > 1_000_000_000_000 ? parsed : parsed * 1000)
  }
  const record = asRecord(value)
  if (record && typeof record.low === "number") {
    return new Date(record.low * 1000)
  }
  return null
}

function parseEvoChatSummary(item: Record<string, unknown>): EvoChatSummary | null {
  const remoteJid =
    (typeof item.remoteJid === "string" ? item.remoteJid : undefined) ??
    (typeof item.id === "string" ? item.id : undefined) ??
    (typeof item.jid === "string" ? item.jid : undefined)

  if (!remoteJid) return null

  const pushName =
    (typeof item.pushName === "string" ? item.pushName : undefined) ??
    (typeof item.name === "string" ? item.name : undefined) ??
    null

  const subject =
    (typeof item.subject === "string" ? item.subject : undefined) ??
    (typeof item.groupSubject === "string" ? item.groupSubject : undefined) ??
    null

  const profilePicUrl =
    (typeof item.profilePicUrl === "string" ? item.profilePicUrl : undefined) ??
    (typeof item.profilePictureUrl === "string" ? item.profilePictureUrl : undefined) ??
    null

  const updatedAt =
    parseUnixTimestamp(item.updatedAt) ??
    parseUnixTimestamp(item.conversationTimestamp) ??
    parseUnixTimestamp(asRecord(item.lastMessage)?.messageTimestamp)

  return { remoteJid, pushName, subject, profilePicUrl, updatedAt }
}

function parseEvoHistoryMessage(item: Record<string, unknown>): EvoHistoryMessage | null {
  const key = asRecord(item.key) ?? {}
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : ""
  const providerMessageId = typeof key.id === "string" ? key.id : ""
  if (!remoteJid || !providerMessageId) return null

  const fromMe = key.fromMe === true
  const messageTimestamp =
    parseUnixTimestamp(item.messageTimestamp) ??
    parseUnixTimestamp(asRecord(item.message)?.messageTimestamp) ??
    new Date()

  return {
    providerMessageId,
    remoteJid,
    fromMe,
    messageTimestamp,
    messagePayload: item.message ?? item,
  }
}

export class EvoApiService implements IEvoApiService {
  async createInstance(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<EvoCreateInstanceResult> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/create`

    console.info("[EvoApiService][createInstance] Creating instance", params.instanceName)

    const data = await fetchEvo<EvoCreateInstanceResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          instanceName: params.instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: buildWebhookPayload(params.webhookUrl),
        }),
      },
      "createInstance"
    )

    const instance = data.instance ?? {}
    const rawStatus = instance.status ?? "close"
    const status = (
      rawStatus === "open" || rawStatus === "connecting" ? rawStatus : "close"
    ) as EvoCreateInstanceResult["status"]

    const qrCode =
      data.qrcode?.code && data.qrcode?.base64
        ? { text: data.qrcode.code, base64: data.qrcode.base64 }
        : null

    return {
      instanceName: instance.instanceName ?? params.instanceName,
      instanceId: instance.instanceId ?? null,
      status,
      qrCode,
    }
  }

  async setWebhook(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<void> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/webhook/set/${encodeURIComponent(params.instanceName)}`

    console.info("[EvoApiService][setWebhook] Updating webhook for", params.instanceName)

    await fetchEvo<unknown>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          webhook: buildWebhookPayload(params.webhookUrl),
        }),
      },
      "setWebhook"
    )
  }

  async adoptOrCreateInstance(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<EvoCreateInstanceResult & { adopted: boolean }> {
    try {
      const created = await this.createInstance(params)
      return { ...created, adopted: false }
    } catch (error) {
      if (!isInstanceNameAlreadyInUseError(error)) {
        throw error
      }

      console.info(
        "[EvoApiService][adoptOrCreateInstance] Adopting existing instance",
        params.instanceName
      )

      const existing = await this.fetchInstance(params.instanceName, params.hostBaseUrl)
      if (!existing) {
        throw error
      }

      await this.setWebhook(params)

      const { state } = await this.getConnectionState(params.instanceName, params.hostBaseUrl)

      let qrCode: { text: string; base64: string } | null = null
      if (state !== "open") {
        try {
          qrCode = await this.getQrCode(params.instanceName, params.hostBaseUrl)
        } catch (qrError) {
          console.error("[EvoApiService][adoptOrCreateInstance] QR fetch failed", qrError)
        }
      }

      return {
        instanceName: existing.instanceName,
        instanceId: null,
        status: state,
        qrCode,
        adopted: true,
      }
    }
  }

  async getQrCode(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<{ text: string; base64: string }> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/connect/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][getQrCode] Fetching QR code for", instanceName)

    const data = await fetchEvo<EvoQrCodeResponse>(
      url,
      {
        method: "GET",
        headers: buildHeaders(apiKey),
      },
      "getQrCode"
    )

    if (!data.code || !data.base64) {
      throw new Error(
        `[EvoApiService][getQrCode] QR code not available for instance "${instanceName}"`
      )
    }

    return { text: data.code, base64: data.base64 }
  }

  async getConnectionState(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<EvoConnectionState> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/connectionState/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][getConnectionState] Checking state for", instanceName)

    const data = await fetchEvo<EvoConnectionStateResponse>(
      url,
      {
        method: "GET",
        headers: buildHeaders(apiKey),
      },
      "getConnectionState"
    )

    const rawState = data.instance?.state ?? "close"
    const state = (
      rawState === "open" || rawState === "connecting" ? rawState : "close"
    ) as EvoConnectionState["state"]

    return {
      instanceName: data.instance?.instanceName ?? instanceName,
      state,
    }
  }

  async fetchInstance(instanceName: string, hostBaseUrl?: string): Promise<EvoInstanceInfo | null> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][fetchInstance] Fetching instance", instanceName)

    const data = await fetchEvo<EvoFetchInstancesResponse | EvoFetchInstancesListResponse>(
      url,
      {
        method: "GET",
        headers: buildHeaders(apiKey),
      },
      "fetchInstance"
    )

    if (Array.isArray(data)) {
      const match = data.find(
        (item) => item.instanceName === instanceName || item.name === instanceName
      )
      if (!match) return null
      return {
        instanceName: match.instanceName ?? match.name ?? instanceName,
        owner: match.owner ?? null,
        profileName: match.profileName ?? null,
      }
    }

    const instance = data.instance
    if (!instance) return null

    return {
      instanceName: instance.instanceName ?? instanceName,
      owner: instance.owner ?? null,
      profileName: instance.profileName ?? null,
    }
  }

  async findChats(instanceName: string, hostBaseUrl?: string): Promise<EvoChatSummary[]> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/chat/findChats/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][findChats] Listing chats for", instanceName)

    const data = await fetchEvo<unknown>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({}),
      },
      "findChats"
    )

    return extractChatArray(data)
      .map(parseEvoChatSummary)
      .filter((chat): chat is EvoChatSummary => chat !== null)
  }

  async findMessages(params: {
    instanceName: string
    remoteJid: string
    since: Date
    hostBaseUrl?: string
  }): Promise<EvoHistoryMessage[]> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/chat/findMessages/${encodeURIComponent(params.instanceName)}`
    const sinceMs = params.since.getTime()
    const collected: EvoHistoryMessage[] = []
    const pageSize = 50
    let page = 1
    let hasMore = true

    while (hasMore && page <= 100) {
      const data = await fetchEvo<unknown>(
        url,
        {
          method: "POST",
          headers: buildHeaders(apiKey),
          body: JSON.stringify({
            where: { key: { remoteJid: params.remoteJid } },
            page,
            offset: pageSize,
          }),
        },
        "findMessages"
      )

      const records = extractMessageRecords(data)
      if (records.length === 0) {
        hasMore = false
        break
      }

      let oldestInPage = Number.POSITIVE_INFINITY
      for (const record of records) {
        const parsed = parseEvoHistoryMessage(record)
        if (!parsed) continue
        const ts = parsed.messageTimestamp.getTime()
        oldestInPage = Math.min(oldestInPage, ts)
        if (ts >= sinceMs) {
          collected.push(parsed)
        }
      }

      if (oldestInPage < sinceMs || records.length < pageSize) {
        hasMore = false
      } else {
        page += 1
      }
    }

    return collected
  }

  async fetchProfilePictureUrl(params: {
    instanceName: string
    remoteJid: string
    hostBaseUrl?: string
  }): Promise<string | null> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/chat/fetchProfilePictureUrl/${encodeURIComponent(params.instanceName)}`
    const number = normalizePhone(normalizeRemoteJid(params.remoteJid))

    if (!number) return null

    try {
      const data = await fetchEvo<{ profilePictureUrl?: string; url?: string }>(
        url,
        {
          method: "POST",
          headers: buildHeaders(apiKey),
          body: JSON.stringify({ number }),
        },
        "fetchProfilePictureUrl"
      )
      return data.profilePictureUrl ?? data.url ?? null
    } catch (error) {
      console.info("[EvoApiService][fetchProfilePictureUrl] No picture for", params.remoteJid, error)
      return null
    }
  }

  async sendTextMessage(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/message/sendText/${encodeURIComponent(params.instanceName)}`

    console.info(
      "[EvoApiService][sendTextMessage] Sending text to",
      params.recipientJid,
      "via",
      params.instanceName
    )

    const body: Record<string, unknown> = {
      number: params.recipientJid,
      text: params.text,
    }
    if (params.mentioned && params.mentioned.length > 0) {
      body.mentioned = params.mentioned
    }
    if (params.linkPreview !== undefined) {
      body.linkPreview = params.linkPreview
    }

    const data = await fetchEvo<EvoSendTextResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      },
      "sendTextMessage"
    )

    const providerMessageId = data.key?.id
    if (!providerMessageId) {
      throw new Error(
        "[EvoApiService][sendTextMessage] Response did not include a message ID"
      )
    }

    return {
      providerMessageId,
      status: data.status ?? "PENDING",
      messageKey: parseEvoMessageKey(data.key, {
        remoteJid: params.recipientJid,
        providerMessageId,
      }),
    }
  }

  async sendMediaMessage(params: {
    instanceName: string
    recipientJid: string
    mediatype: "image" | "document" | "audio" | "video"
    mimeType: string
    fileName: string
    base64: string
    caption?: string
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/message/sendMedia/${encodeURIComponent(params.instanceName)}`

    console.info(
      "[EvoApiService][sendMediaMessage] Sending",
      params.mediatype,
      "to",
      params.recipientJid
    )

    const data = await fetchEvo<EvoSendTextResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          number: params.recipientJid,
          mediatype: params.mediatype,
          mimetype: params.mimeType,
          fileName: params.fileName,
          media: params.base64,
          caption: params.caption,
        }),
      },
      "sendMediaMessage"
    )

    const providerMessageId = data.key?.id
    if (!providerMessageId) {
      throw new Error("[EvoApiService][sendMediaMessage] Response did not include a message ID")
    }

    return {
      providerMessageId,
      status: data.status ?? "PENDING",
      messageKey: parseEvoMessageKey(data.key, {
        remoteJid: params.recipientJid,
        providerMessageId,
      }),
    }
  }

  async getBase64FromMediaMessage(params: {
    instanceName: string
    messageKey: Record<string, unknown>
    hostBaseUrl?: string
  }): Promise<{ base64: string; mimeType: string } | null> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/chat/getBase64FromMediaMessage/${encodeURIComponent(params.instanceName)}`

    try {
      const data = await fetchEvo<{
        base64?: string
        mimetype?: string
        mediaType?: string
      }>(
        url,
        {
          method: "POST",
          headers: buildHeaders(apiKey),
          body: JSON.stringify({ message: { key: params.messageKey } }),
        },
        "getBase64FromMediaMessage"
      )

      if (!data.base64) return null
      return {
        base64: data.base64,
        mimeType: data.mimetype ?? "application/octet-stream",
      }
    } catch (error) {
      console.error("[EvoApiService][getBase64FromMediaMessage]", error)
      return null
    }
  }

  async findContacts(
    instanceName: string,
    hostBaseUrl?: string
  ): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null }>> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/chat/findContacts/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][findContacts] Listing contacts for", instanceName)

    const data = await fetchEvo<unknown>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({}),
      },
      "findContacts"
    )

    const items = Array.isArray(data) ? data : []
    return items
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        remoteJid:
          (typeof item.id === "string" ? item.id : undefined) ??
          (typeof item.remoteJid === "string" ? item.remoteJid : "") ??
          "",
        pushName:
          (typeof item.pushName === "string" ? item.pushName : undefined) ??
          (typeof item.name === "string" ? item.name : null) ??
          null,
        phoneNumber: typeof item.phoneNumber === "string" ? item.phoneNumber : null,
      }))
      .filter((item) => item.remoteJid.length > 0)
  }

  async findGroupParticipants(params: {
    instanceName: string
    groupJid: string
    hostBaseUrl?: string
  }): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null; admin: string | null }>> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/group/participants/${encodeURIComponent(params.instanceName)}?groupJid=${encodeURIComponent(params.groupJid)}`

    console.info(
      "[EvoApiService][findGroupParticipants] Listing participants for",
      params.groupJid
    )

    const data = await fetchEvo<unknown>(
      url,
      {
        method: "GET",
        headers: buildHeaders(apiKey),
      },
      "findGroupParticipants"
    )

    const participants = Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && Array.isArray((data as Record<string, unknown>).participants)
        ? ((data as Record<string, unknown>).participants as unknown[])
        : []

    return participants
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        remoteJid:
          (typeof item.id === "string" ? item.id : undefined) ??
          (typeof item.remoteJid === "string" ? item.remoteJid : "") ??
          "",
        pushName:
          (typeof item.pushName === "string" ? item.pushName : undefined) ??
          (typeof item.name === "string" ? item.name : null) ??
          null,
        phoneNumber: typeof item.phoneNumber === "string" ? item.phoneNumber : null,
        admin: typeof item.admin === "string" ? item.admin : null,
      }))
      .filter((item) => item.remoteJid.length > 0)
  }

  async disconnectInstance(instanceName: string, hostBaseUrl?: string): Promise<void> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/logout/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][disconnectInstance] Logging out", instanceName)

    await fetchEvo<unknown>(
      url,
      {
        method: "DELETE",
        headers: buildHeaders(apiKey),
      },
      "disconnectInstance"
    )
  }

  async deleteInstance(instanceName: string, hostBaseUrl?: string): Promise<void> {
    const base = getBaseUrl(hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/instance/delete/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][deleteInstance] Deleting instance", instanceName)

    await fetchEvo<unknown>(
      url,
      {
        method: "DELETE",
        headers: buildHeaders(apiKey),
      },
      "deleteInstance"
    )
  }
}

export const evoApiService = new EvoApiService()
