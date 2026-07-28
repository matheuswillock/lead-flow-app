import type {
  EvoChatSummary,
  EvoConnectionState,
  EvoCreateInstanceResult,
  EvoHistoryMessage,
  EvoInstanceInfo,
  EvoSendTextResult,
  IEvoApiService,
} from "./IEvoApiService"
import { logSafeWhatsAppError } from "@/lib/whatsapp/safe-observability"
import { WHATSAPP_EVO_WEBHOOK_EVENTS } from "./IEvoApiService"
import { normalizePhone, normalizeRemoteJid } from "../phoneUtils"
import { deriveWebhookHeaderSecret, extractWebhookSecretFromUrl, WHATSAPP_WEBHOOK_HEADER_NAME } from "@/lib/whatsapp/webhook-header-auth"
import {
  getWhatsAppCorrelationId,
  logWhatsAppProviderFailure,
  toWhatsAppSafeErrorCode,
} from "@/lib/whatsapp/safe-observability"

/** Resolves Evolution base URL from env only — never accepts per-request hosts (SSRF). */
export function resolveEvoApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  const envUrl = env.EVO_API_BASE_URL
  if (!envUrl) throw new Error("[EvoApiService] EVO_API_BASE_URL is not set")
  let url: URL
  try {
    url = new URL(envUrl)
  } catch {
    throw new Error("[EvoApiService] EVO_API_BASE_URL is invalid")
  }
  if (url.protocol !== "https:" && env.NODE_ENV === "production") {
    throw new Error("[EvoApiService] EVO_API_BASE_URL must use HTTPS in production")
  }
  return url.toString().replace(/\/$/, "")
}

function getBaseUrl(): string {
  return resolveEvoApiBaseUrl()
}

function getApiKey(): string {
  const key = process.env.EVO_API_KEY
  if (!key) throw new Error("[EvoApiService] EVO_API_KEY is not set")
  return key
}

const EVO_REQUEST_TIMEOUT_MS = 10_000
const EVO_SEND_REQUEST_TIMEOUT_MS = 60_000

export class EvoProviderError extends Error {
  constructor(
    readonly code: "provider_timeout" | "provider_network" | "provider_http" | "instance_name_in_use" | "invalid_provider_response",
    readonly correlationId: string,
    readonly httpStatus?: number
  ) {
    super(`[EvoApiService] ${code} (${correlationId})`)
    this.name = "EvoProviderError"
  }
}

async function classifyProviderFailure(response: Response): Promise<"instance_name_in_use" | "provider_http"> {
  if (response.status !== 403) return "provider_http"
  try {
    const body = await response.clone().text()
    return /already in use|nome.*uso|instance.*exist/i.test(body)
      ? "instance_name_in_use"
      : "provider_http"
  } catch {
    return "provider_http"
  }
}

async function fetchEvo<T>(
  url: string,
  options: RequestInit,
  label: string
): Promise<T> {
  const correlationId = getWhatsAppCorrelationId()
  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(EVO_REQUEST_TIMEOUT_MS),
      redirect: "error",
    })
  } catch (error) {
    logWhatsAppProviderFailure({ operation: label, correlationId, error })
    throw new EvoProviderError(
      toWhatsAppSafeErrorCode(error) === "provider_timeout" ? "provider_timeout" : "provider_network",
      correlationId
    )
  }

  if (!response.ok) {
    logWhatsAppProviderFailure({ operation: label, correlationId, status: response.status })
    throw new EvoProviderError(await classifyProviderFailure(response), correlationId, response.status)
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    logWhatsAppProviderFailure({ operation: label, correlationId, error })
    throw new EvoProviderError("invalid_provider_response", correlationId)
  }
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  }
}

export function isInstanceNameAlreadyInUseError(error: unknown): boolean {
  return error instanceof EvoProviderError && error.code === "instance_name_in_use"
}

function buildWebhookPayload(webhookUrl: string) {
  const webhookSecret = extractWebhookSecretFromUrl(webhookUrl)
  const headerSecret = webhookSecret ? deriveWebhookHeaderSecret(webhookSecret) : null
  return {
    enabled: true,
    url: webhookUrl,
    events: [...WHATSAPP_EVO_WEBHOOK_EVENTS],
    ...(headerSecret ? { headers: { [WHATSAPP_WEBHOOK_HEADER_NAME]: headerSecret } } : {}),
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
    messageBody: item.message ?? item,
    rawRecord: item,
  }
}

export class EvoApiService implements IEvoApiService {
  async createInstance(params: {
    instanceName: string
    webhookUrl: string
  }): Promise<EvoCreateInstanceResult> {
    const base = getBaseUrl()
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
  }): Promise<void> {
    const base = getBaseUrl()
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

      const existing = await this.fetchInstance(params.instanceName)
      if (!existing) {
        throw error
      }

      await this.setWebhook(params)

      const { state } = await this.getConnectionState(params.instanceName)

      let qrCode: { text: string; base64: string } | null = null
      if (state !== "open") {
        try {
          qrCode = await this.getQrCode(params.instanceName)
        } catch (qrError) {
          logSafeWhatsAppError("[EvoApiService][adoptOrCreateInstance] QR fetch failed", qrError)
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

  async getQrCode(instanceName: string): Promise<{ text: string; base64: string }> {
    const base = getBaseUrl()
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

  async getConnectionState(instanceName: string): Promise<EvoConnectionState> {
    const base = getBaseUrl()
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

  async fetchInstance(instanceName: string): Promise<EvoInstanceInfo | null> {
    const base = getBaseUrl()
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

  async findChats(instanceName: string): Promise<EvoChatSummary[]> {
    const base = getBaseUrl()
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
  }): Promise<EvoHistoryMessage[]> {
    const base = getBaseUrl()
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
  }): Promise<string | null> {
    const base = getBaseUrl()
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
    } catch (_error) {
      console.info("[EvoApiService][fetchProfilePictureUrl] imagem indisponível")
      return null
    }
  }

  async sendTextMessage(params: {
    instanceName: string
    recipientJid: string
    text: string
    mentioned?: string[]
    linkPreview?: boolean
    quoted?: {
      providerMessageId: string
      fromMe?: boolean
      remoteJid?: string
    }
  }): Promise<EvoSendTextResult> {
    const base = getBaseUrl()
    const apiKey = getApiKey()
    const url = `${base}/message/sendText/${encodeURIComponent(params.instanceName)}`

    console.info("[EvoApiService][sendTextMessage] enviando texto")

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
    if (params.quoted) {
      body.quoted = {
        key: {
          id: params.quoted.providerMessageId,
          ...(params.quoted.fromMe !== undefined ? { fromMe: params.quoted.fromMe } : {}),
          ...(params.quoted.remoteJid ? { remoteJid: params.quoted.remoteJid } : {}),
        },
      }
    }

    const data = await fetchEvo<EvoSendTextResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(EVO_SEND_REQUEST_TIMEOUT_MS),
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
    quoted?: {
      providerMessageId: string
      fromMe?: boolean
      remoteJid?: string
    }
  }): Promise<EvoSendTextResult> {
    const base = getBaseUrl()
    const apiKey = getApiKey()
    const url = `${base}/message/sendMedia/${encodeURIComponent(params.instanceName)}`

    console.info("[EvoApiService][sendMediaMessage] enviando mídia", { mediatype: params.mediatype })

    const body: Record<string, unknown> = {
      number: params.recipientJid,
      mediatype: params.mediatype,
      mimetype: params.mimeType,
      fileName: params.fileName,
      media: params.base64,
      caption: params.caption,
    }
    if (params.quoted) {
      body.quoted = {
        key: {
          id: params.quoted.providerMessageId,
          ...(params.quoted.fromMe !== undefined ? { fromMe: params.quoted.fromMe } : {}),
          ...(params.quoted.remoteJid ? { remoteJid: params.quoted.remoteJid } : {}),
        },
      }
    }

    const data = await fetchEvo<EvoSendTextResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(EVO_SEND_REQUEST_TIMEOUT_MS),
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
  }): Promise<{ base64: string; mimeType: string } | null> {
    const base = getBaseUrl()
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
      logSafeWhatsAppError("[EvoApiService][getBase64FromMediaMessage]", error)
      return null
    }
  }

  async findContacts(instanceName: string): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null }>> {
    const base = getBaseUrl()
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
  }): Promise<Array<{ remoteJid: string; pushName: string | null; phoneNumber: string | null; admin: string | null }>> {
    const base = getBaseUrl()
    const apiKey = getApiKey()
    const url = `${base}/group/participants/${encodeURIComponent(params.instanceName)}?groupJid=${encodeURIComponent(params.groupJid)}`

    console.info("[EvoApiService][findGroupParticipants] listando participantes")

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

  async markMessagesAsRead(params: {
    instanceName: string
    readMessages: Array<{ remoteJid: string; fromMe: boolean; id: string }>
  }): Promise<void> {
    if (params.readMessages.length === 0) return

    const base = getBaseUrl()
    const apiKey = getApiKey()
    const url = `${base}/chat/markMessageAsRead/${encodeURIComponent(params.instanceName)}`

    console.info(
      "[EvoApiService][markMessagesAsRead] Marking",
      params.readMessages.length,
      "message(s) as read for",
      params.instanceName
    )

    await fetchEvo<unknown>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({ readMessages: params.readMessages }),
      },
      "markMessagesAsRead"
    )
  }

  async disconnectInstance(instanceName: string): Promise<void> {
    const base = getBaseUrl()
    const apiKey = getApiKey()
    const url = `${base}/instance/logout/${encodeURIComponent(instanceName)}`

    console.info("[EvoApiService][disconnectInstance] Logging out", instanceName)

    try {
      await fetchEvo<unknown>(
        url,
        {
          method: "DELETE",
          headers: buildHeaders(apiKey),
        },
        "disconnectInstance"
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const normalized = message.toLowerCase()
      const alreadyDisconnected =
        normalized.includes("connection closed") ||
        ((message.includes("HTTP 400") || message.includes("HTTP 404")) &&
          (normalized.includes("not connected") ||
            normalized.includes("already disconnected") ||
            normalized.includes("is not connected")))

      if (alreadyDisconnected) {
        console.info(
          "[EvoApiService][disconnectInstance] Instance already disconnected",
          instanceName
        )
        return
      }

      throw error
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    const base = getBaseUrl()
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
