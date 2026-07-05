import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { EvoApiService } from "./EvoApiService"

const INSTANCE = "team_test"
const BASE_URL = "http://evo.test"
const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("EvoApiService.markMessagesAsRead", () => {
  const service = new EvoApiService()

  beforeEach(() => {
    process.env.EVO_API_BASE_URL = BASE_URL
    process.env.EVO_API_KEY = "test-key"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("não chama fetch quando readMessages está vazio", async () => {
    let fetchCallCount = 0
    globalThis.fetch = mock(async () => {
      fetchCallCount += 1
      return jsonResponse({ read: "success" })
    }) as unknown as typeof fetch

    await service.markMessagesAsRead({
      instanceName: INSTANCE,
      readMessages: [],
    })

    expect(fetchCallCount).toBe(0)
  })

  it("envia POST com readMessages no body", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined

    globalThis.fetch = mock(async (input, init) => {
      capturedUrl = String(input)
      capturedInit = init
      return jsonResponse({ message: "Read messages", read: "success" })
    }) as unknown as typeof fetch

    await service.markMessagesAsRead({
      instanceName: INSTANCE,
      readMessages: [
        {
          remoteJid: "5511999999999@s.whatsapp.net",
          fromMe: false,
          id: "msg-inbound-1",
        },
      ],
    })

    expect(capturedUrl).toContain("/chat/markMessageAsRead/")
    expect(capturedUrl).toContain(INSTANCE)
    expect(capturedInit?.method).toBe("POST")
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      readMessages: [
        {
          remoteJid: "5511999999999@s.whatsapp.net",
          fromMe: false,
          id: "msg-inbound-1",
        },
      ],
    })
  })
})
