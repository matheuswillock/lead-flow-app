import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { EvoApiService } from "./EvoApiService"

const INSTANCE = "team_test"
const BASE_URL = "http://evo.test"
const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("EvoApiService.sendTextMessage", () => {
  const service = new EvoApiService()
  let fetchCallCount = 0

  beforeEach(() => {
    fetchCallCount = 0
    process.env.EVO_API_BASE_URL = BASE_URL
    process.env.EVO_API_KEY = "test-key"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("não repete envio após timeout/abort", async () => {
    globalThis.fetch = mock(async () => {
      fetchCallCount += 1
      const error = new Error("The operation was aborted due to timeout")
      error.name = "TimeoutError"
      throw error
    }) as unknown as typeof fetch

    await expect(
      service.sendTextMessage({
        instanceName: INSTANCE,
        recipientJid: "5511999999999@s.whatsapp.net",
        text: "Olá",
      })
    ).rejects.toThrow("Network request failed")

    expect(fetchCallCount).toBe(1)
  })

  it("envia texto com sucesso sem retry", async () => {
    globalThis.fetch = mock(async (input, init) => {
      fetchCallCount += 1
      const url = String(input)
      expect(url).toContain("/message/sendText/")
      expect(init?.method).toBe("POST")

      return jsonResponse({
        key: { id: "msg-123", remoteJid: "5511999999999@s.whatsapp.net", fromMe: true },
        status: "PENDING",
      })
    }) as unknown as typeof fetch

    const result = await service.sendTextMessage({
      instanceName: INSTANCE,
      recipientJid: "5511999999999@s.whatsapp.net",
      text: "Olá",
    })

    expect(result.providerMessageId).toBe("msg-123")
    expect(fetchCallCount).toBe(1)
  })
})
