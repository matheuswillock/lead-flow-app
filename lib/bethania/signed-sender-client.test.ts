import { createHmac } from "node:crypto"
import { describe, expect, it } from "bun:test"
import { sendBethaniaTransportEvent } from "./signed-sender-client"

const EVENT = {
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  eventType: "account.whatsapp_verification" as const,
  phone: "+15551234567",
  message: "Código Bethânia: 123456",
}
const SECRET = "test-secret-do-not-use-in-production"

describe("sendBethaniaTransportEvent", () => {
  it("signs exact serialized body and reports only accepted transport status", async () => {
    const now = 1_800_000_000_000
    let captured: { url: string; init: RequestInit } | undefined
    const result = await sendBethaniaTransportEvent(EVENT, {
      baseUrl: "http://127.0.0.1:8787",
      secret: SECRET,
      now: () => now,
      fetchImpl: async (url, init) => {
        captured = { url: String(url), init: init ?? {} }
        return new Response('{"accepted":true}', { status: 202 })
      },
    })

    const body = JSON.stringify(EVENT)
    const timestamp = String(Math.floor(now / 1000))
    const signature = createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex")

    expect(result).toEqual({ accepted: true })
    expect(captured?.url).toBe("http://127.0.0.1:8787/events")
    expect(captured?.init.body).toBe(body)
    expect(new Headers(captured?.init.headers).get("X-Bethania-Timestamp")).toBe(timestamp)
    expect(new Headers(captured?.init.headers).get("X-Bethania-Signature")).toBe(`v1=${signature}`)
  })

  it("fails with a sanitized error when the receiver does not accept the event", async () => {
    await expect(
      sendBethaniaTransportEvent(EVENT, {
        baseUrl: "http://127.0.0.1:8787",
        secret: SECRET,
        fetchImpl: async () => new Response("sensitive downstream detail", { status: 502 }),
      }),
    ).rejects.toThrow("Bethânia sender did not accept the event")
  })

  it("refuses empty secrets without making a network request", async () => {
    let called = false
    await expect(
      sendBethaniaTransportEvent(EVENT, {
        baseUrl: "http://127.0.0.1:8787",
        secret: "",
        fetchImpl: async () => {
          called = true
          return new Response(null, { status: 202 })
        },
      }),
    ).rejects.toThrow("Bethânia sender configuration is incomplete")
    expect(called).toBe(false)
  })
})
