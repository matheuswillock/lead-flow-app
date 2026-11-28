import { afterEach, describe, expect, it } from "bun:test"
import { createHmac } from "node:crypto"
import type { Server } from "node:http"
import { createBethaniaWebhookServer } from "./BethaniaWebhookServer"
import type { IWhatsAppSender } from "./HermesWhatsAppSender"

const SECRET = "test-only-bethania-secret"
const EVENT = {
  eventId: "evt-123",
  eventType: "schedule.created_or_rescheduled",
  phone: "+15551234567",
  message: "Agenda de hoje",
}

const activeServers: Server[] = []

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

async function startServer(sender: IWhatsAppSender, options: { now?: () => number; maxBodyBytes?: number } = {}) {
  const server = createBethaniaWebhookServer({ secret: SECRET, sender, ...options })
  activeServers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Expected a TCP address")
  return `http://127.0.0.1:${address.port}`
}

function signedHeaders(rawBody: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const digest = createHmac("sha256", SECRET).update(`${timestamp}.${rawBody}`).digest("hex")
  return { "X-Bethania-Timestamp": timestamp, "X-Bethania-Signature": `v1=${digest}` }
}

async function postEvent(baseUrl: string, rawBody = JSON.stringify(EVENT), headers = signedHeaders(rawBody)) {
  return fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  })
}

describe("Bethania webhook HTTP transport", () => {
  it("acknowledges a valid signed event after the injected sender accepts it", async () => {
    const calls: Array<[string, string]> = []
    const sender = { send: async (phone: string, message: string) => { calls.push([phone, message]) } }
    const baseUrl = await startServer(sender)

    const response = await postEvent(baseUrl)

    expect(response.status).toBe(202)
    expect(calls).toEqual([[EVENT.phone, EVENT.message]])
    expect(await response.json()).toEqual({ accepted: true })
  })

  it("accepts a server-generated account verification event", async () => {
    const calls: Array<[string, string]> = []
    const sender = { send: async (phone: string, message: string) => { calls.push([phone, message]) } }
    const baseUrl = await startServer(sender)
    const verificationEvent = { ...EVENT, eventType: "account.whatsapp_verification" }

    const response = await postEvent(baseUrl, JSON.stringify(verificationEvent))

    expect(response.status).toBe(202)
    expect(calls).toEqual([[verificationEvent.phone, verificationEvent.message]])
  })

  it("rejects invalid signature and stale timestamps before sender invocation", async () => {
    let calls = 0
    const baseUrl = await startServer({ send: async () => { calls += 1 } }, { now: () => 1_800_000_000_000 })
    const rawBody = JSON.stringify(EVENT)
    const invalidHeaders = {
      ...signedHeaders(rawBody),
      "X-Bethania-Signature": `v1=${"0".repeat(64)}`,
    }
    const invalidSignature = await postEvent(baseUrl, rawBody, invalidHeaders)
    const staleTimestamp = "1799999000"
    const stale = await postEvent(baseUrl, rawBody, signedHeaders(rawBody, staleTimestamp))

    expect(invalidSignature.status).toBe(401)
    expect(stale.status).toBe(401)
    expect(calls).toBe(0)
  })

  it("rejects signed malformed events and oversized bodies without sender invocation", async () => {
    let calls = 0
    const baseUrl = await startServer({ send: async () => { calls += 1 } }, { maxBodyBytes: 128 })
    const malformed = JSON.stringify({ ...EVENT, eventType: "unsupported.event" })
    const invalid = await postEvent(baseUrl, malformed)
    const tooLargeBody = JSON.stringify({ ...EVENT, message: "x".repeat(500) })
    const tooLarge = await postEvent(baseUrl, tooLargeBody)

    expect(invalid.status).toBe(400)
    expect(tooLarge.status).toBe(413)
    expect(calls).toBe(0)
  })

  it("rejects signed events with invalid E.164 numbers and blank or oversized messages", async () => {
    let calls = 0
    const baseUrl = await startServer({ send: async () => { calls += 1 } })
    const badPhone = await postEvent(baseUrl, JSON.stringify({ ...EVENT, phone: "15551234567" }))
    const blankMessage = await postEvent(baseUrl, JSON.stringify({ ...EVENT, message: "  " }))
    const oversizedMessage = await postEvent(baseUrl, JSON.stringify({ ...EVENT, message: "x".repeat(4_001) }))

    expect(badPhone.status).toBe(400)
    expect(blankMessage.status).toBe(400)
    expect(oversizedMessage.status).toBe(400)
    expect(calls).toBe(0)
  })

  it("sanitizes transport failures and invokes the sender once without retry", async () => {
    const secret = SECRET
    const errorText = `${EVENT.phone} ${EVENT.message} ${secret}`
    let calls = 0
    const baseUrl = await startServer({ send: async () => { calls += 1; throw new Error(errorText) } })
    const response = await postEvent(baseUrl)
    const body = await response.text()

    expect(response.status).toBe(502)
    expect(body).toBe(JSON.stringify({ error: "sender_unavailable" }))
    expect(body).not.toContain(EVENT.phone)
    expect(body).not.toContain(EVENT.message)
    expect(body).not.toContain(secret)
    expect(calls).toBe(1)
  })

  it("verifies signatures over exact raw body bytes before JSON decoding", async () => {
    const baseUrl = await startServer({ send: async () => { throw new Error("must not send") } })
    const rawBody = Buffer.from('{"eventId":"evt-123","eventType":"schedule.created_or_rescheduled","phone":"+15551234567","message":"ok\u00ff"}', "binary")
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac("sha256", SECRET).update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest("hex")
    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Bethania-Timestamp": timestamp,
        "X-Bethania-Signature": `v1=${signature}`,
      },
      body: rawBody,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid_payload" })
  })

  it("exposes only health status at GET /healthz", async () => {
    const baseUrl = await startServer({ send: async () => {} })
    const response = await fetch(`${baseUrl}/healthz`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })
})
