import type {
  EvoConnectionState,
  EvoCreateInstanceResult,
  EvoSendTextResult,
  IEvoApiService,
} from "./IEvoApiService"

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
  }
  status?: string
  message?: {
    conversation?: string
  }
}

interface EvoQrCodeResponse {
  pairingCode?: string
  code?: string
  base64?: string
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
          webhook: {
            url: params.webhookUrl,
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
              "SEND_MESSAGE",
            ],
          },
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

  async sendTextMessage(params: {
    instanceName: string
    recipientPhone: string
    text: string
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult> {
    const base = getBaseUrl(params.hostBaseUrl)
    const apiKey = getApiKey()
    const url = `${base}/message/sendText/${encodeURIComponent(params.instanceName)}`

    console.info(
      "[EvoApiService][sendTextMessage] Sending text to",
      params.recipientPhone,
      "via",
      params.instanceName
    )

    const data = await fetchEvo<EvoSendTextResponse>(
      url,
      {
        method: "POST",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          number: params.recipientPhone,
          text: params.text,
        }),
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
    }
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
