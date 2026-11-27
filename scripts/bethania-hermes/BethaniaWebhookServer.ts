import { createHmac, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { IWhatsAppSender } from "./HermesWhatsAppSender"

const EVENT_TYPES = new Set([
  "schedule.created_or_rescheduled",
  "agenda.daily_0700",
  "meeting.follow_up_1h",
  "agenda.overdue_1500",
  "account.whatsapp_verification",
])
const E164_PATTERN = /^\+[1-9]\d{7,14}$/
const MAX_MESSAGE_LENGTH = 4_000
const DEFAULT_MAX_BODY_BYTES = 16_384
const MAX_TIMESTAMP_AGE_SECONDS = 300

export interface BethaniaWebhookOptions {
  secret: string
  sender: IWhatsAppSender
  now?: () => number
  maxBodyBytes?: number
}

interface BethaniaEvent {
  eventId: string
  eventType: string
  phone: string
  message: string
}

function reply(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
  response.end(JSON.stringify(body))
}

function isBethaniaEvent(value: unknown): value is BethaniaEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  return typeof event.eventId === "string" && event.eventId.length > 0 && event.eventId.length <= 128
    && typeof event.eventType === "string" && EVENT_TYPES.has(event.eventType)
    && typeof event.phone === "string" && E164_PATTERN.test(event.phone)
    && typeof event.message === "string" && event.message.trim().length > 0
    && event.message.length <= MAX_MESSAGE_LENGTH
}

function signatureIsValid(secret: string, timestamp: string | undefined, signature: string | undefined, rawBody: Buffer, now: number): boolean {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature || !/^v1=[a-f0-9]{64}$/.test(signature)) return false
  const timestampSeconds = Number(timestamp)
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Math.floor(now / 1000) - timestampSeconds) > MAX_TIMESTAMP_AGE_SECONDS) return false
  const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest()
  const supplied = Buffer.from(signature.slice(3), "hex")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<Buffer | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) return null
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, options: BethaniaWebhookOptions): Promise<void> {
  if (request.method === "GET" && request.url === "/healthz") {
    reply(response, 200, { status: "ok" })
    return
  }
  if (request.method !== "POST" || request.url !== "/events") {
    reply(response, 404, { error: "not_found" })
    return
  }

  let rawBody: Buffer | null
  try {
    rawBody = await readBody(request, options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)
  } catch {
    reply(response, 400, { error: "invalid_request" })
    return
  }
  if (rawBody === null) {
    reply(response, 413, { error: "payload_too_large" })
    return
  }
  const timestampHeader = request.headers["x-bethania-timestamp"]
  const signatureHeader = request.headers["x-bethania-signature"]
  if (!signatureIsValid(
    options.secret,
    typeof timestampHeader === "string" ? timestampHeader : undefined,
    typeof signatureHeader === "string" ? signatureHeader : undefined,
    rawBody,
    (options.now ?? Date.now)(),
  )) {
    reply(response, 401, { error: "invalid_signature" })
    return
  }

  let bodyText: string
  try {
    bodyText = new TextDecoder("utf-8", { fatal: true }).decode(rawBody)
  } catch {
    reply(response, 400, { error: "invalid_payload" })
    return
  }
  let event: unknown
  try {
    event = JSON.parse(bodyText)
  } catch {
    reply(response, 400, { error: "invalid_payload" })
    return
  }
  if (!isBethaniaEvent(event)) {
    reply(response, 400, { error: "invalid_payload" })
    return
  }

  try {
    await options.sender.send(event.phone, event.message)
    reply(response, 202, { accepted: true })
  } catch {
    // Never include transport details: they may contain the recipient or message.
    reply(response, 502, { error: "sender_unavailable" })
  }
}

export function createBethaniaWebhookServer(options: BethaniaWebhookOptions): Server {
  if (!options.secret) throw new Error("Bethania webhook secret is required")
  if (!Number.isSafeInteger(options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES) || (options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES) < 1) {
    throw new Error("Bethania webhook body limit must be a positive integer")
  }
  return createServer((request, response) => {
    void handleRequest(request, response, options).catch(() => {
      if (!response.headersSent) reply(response, 500, { error: "internal_error" })
      else response.destroy()
    })
  })
}
