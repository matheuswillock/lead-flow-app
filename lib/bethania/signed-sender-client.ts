import { createHmac } from "node:crypto"
import type { AgendaEventType } from "./agenda-rules"

export type BethaniaTransportEventType = AgendaEventType | "account.whatsapp_verification"

export type BethaniaTransportEvent = {
  eventId: string
  eventType: BethaniaTransportEventType
  phone: string
  message: string
}

export type BethaniaSenderClientOptions = {
  baseUrl: string
  secret: string
  fetchImpl?: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
  now?: () => number
}

export async function sendBethaniaTransportEvent(
  event: BethaniaTransportEvent,
  options: BethaniaSenderClientOptions,
): Promise<{ accepted: true }> {
  if (!options.baseUrl || !options.secret) {
    throw new Error("Bethânia sender configuration is incomplete")
  }

  let endpoint: URL
  try {
    endpoint = new URL("/events", options.baseUrl)
  } catch {
    throw new Error("Bethânia sender configuration is incomplete")
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username.length > 0 ||
    endpoint.password.length > 0
  ) {
    throw new Error("Bethânia sender configuration is incomplete")
  }

  const now = (options.now ?? Date.now)()
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new Error("Bethânia sender configuration is incomplete")
  }

  const timestamp = String(Math.floor(now / 1_000))
  const body = JSON.stringify(event)
  const signature = createHmac("sha256", options.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")

  let response: Response
  try {
    response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "content-type": "application/json",
        "x-bethania-timestamp": timestamp,
        "x-bethania-signature": `v1=${signature}`,
      },
      body,
    })
  } catch {
    throw new Error("Bethânia sender did not accept the event")
  }

  if (response.status !== 202) {
    throw new Error("Bethânia sender did not accept the event")
  }
  return { accepted: true }
}
