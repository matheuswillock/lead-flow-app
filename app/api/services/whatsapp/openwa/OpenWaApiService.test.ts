import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { OpenWaApiService } from "./OpenWaApiService"

const INSTANCE = "team_openwa_test"
const BASE_URL = "http://openwa.test"
const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("OpenWaApiService", () => {
  let service: OpenWaApiService

  beforeEach(() => {
    process.env.OPENWA_API_URL = BASE_URL
    process.env.OPENWA_API_KEY = "test-api-key"
    service = new OpenWaApiService()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.OPENWA_API_URL
    delete process.env.OPENWA_API_KEY
  })

  describe("startSession", () => {
    it("faz POST /session/start/:instance com webhookUrl no body", async () => {
      let capturedUrl = ""
      let capturedBody: unknown

      globalThis.fetch = mock(async (input, init) => {
        capturedUrl = String(input)
        capturedBody = JSON.parse(init?.body as string)
        return jsonResponse({ success: true })
      }) as unknown as typeof fetch

      await service.startSession(INSTANCE, "https://my.app/webhook")

      expect(capturedUrl).toBe(`${BASE_URL}/session/start/${INSTANCE}`)
      expect(capturedBody).toMatchObject({ webhookUrl: "https://my.app/webhook" })
    })

    it("lança erro descritivo em resposta não-2xx", async () => {
      globalThis.fetch = mock(async () => jsonResponse({ error: "not found" }, 404)) as unknown as typeof fetch

      await expect(service.startSession(INSTANCE, "https://my.app/webhook")).rejects.toThrow(
        "[OpenWaApiService] POST /session/start/"
      )
    })
  })

  describe("getSessionStatus", () => {
    it("faz GET /session/status/:instance e retorna CONNECTED", async () => {
      globalThis.fetch = mock(async () =>
        jsonResponse({ status: "CONNECTED" })
      ) as unknown as typeof fetch

      const result = await service.getSessionStatus(INSTANCE)

      expect(result).toEqual({ status: "CONNECTED" })
    })

    it("mapeia status QR_READY com qr", async () => {
      globalThis.fetch = mock(async () =>
        jsonResponse({ status: "QR_READY", qr: "data:image/png;base64,abc" })
      ) as unknown as typeof fetch

      const result = await service.getSessionStatus(INSTANCE)

      expect(result).toEqual({ status: "QR_READY", qr: "data:image/png;base64,abc" })
    })

    it("lança erro em resposta não-2xx", async () => {
      globalThis.fetch = mock(async () => jsonResponse({}, 500)) as unknown as typeof fetch

      await expect(service.getSessionStatus(INSTANCE)).rejects.toThrow(
        "[OpenWaApiService] GET /session/status/"
      )
    })
  })

  describe("deleteSession", () => {
    it("faz DELETE /session/delete/:instance", async () => {
      let capturedMethod = ""
      let capturedUrl = ""

      globalThis.fetch = mock(async (input, init) => {
        capturedMethod = init?.method ?? ""
        capturedUrl = String(input)
        return jsonResponse({ success: true })
      }) as unknown as typeof fetch

      await service.deleteSession(INSTANCE)

      expect(capturedMethod).toBe("DELETE")
      expect(capturedUrl).toBe(`${BASE_URL}/session/delete/${INSTANCE}`)
    })
  })

  describe("sendText", () => {
    it("faz POST /client/sendMessage/:instance e retorna messageId", async () => {
      globalThis.fetch = mock(async () =>
        jsonResponse({ messageId: "msg-abc-123" })
      ) as unknown as typeof fetch

      const result = await service.sendText(INSTANCE, "5511999999999", "Olá")

      expect(result.messageId).toBe("msg-abc-123")
    })

    it("lança erro em resposta não-2xx", async () => {
      globalThis.fetch = mock(async () => jsonResponse({}, 422)) as unknown as typeof fetch

      await expect(service.sendText(INSTANCE, "5511999999999", "Olá")).rejects.toThrow(
        "[OpenWaApiService] POST /client/sendMessage/"
      )
    })
  })

  describe("sendMedia", () => {
    it("faz POST /client/sendMedia/:instance e retorna messageId", async () => {
      globalThis.fetch = mock(async () =>
        jsonResponse({ messageId: "msg-media-456" })
      ) as unknown as typeof fetch

      const result = await service.sendMedia(INSTANCE, {
        to: "5511999999999",
        base64: "data:image/png;base64,abc",
        mimetype: "image/png",
        filename: "foto.png",
        caption: "Segue a imagem",
      })

      expect(result.messageId).toBe("msg-media-456")
    })
  })

  describe("markChatSeen", () => {
    it("faz POST /client/markChatSeen/:instance com chatId no body", async () => {
      let capturedBody: unknown

      globalThis.fetch = mock(async (_input, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return jsonResponse({ success: true })
      }) as unknown as typeof fetch

      await service.markChatSeen(INSTANCE, "5511999999999@c.us")

      expect(capturedBody).toMatchObject({ chatId: "5511999999999@c.us" })
    })
  })

  describe("configuração de env", () => {
    it("lança se OPENWA_API_URL não estiver definido ao chamar método", async () => {
      delete process.env.OPENWA_API_URL
      globalThis.fetch = mock(async () => jsonResponse({})) as unknown as typeof fetch
      await expect(new OpenWaApiService().startSession("x", "http://x")).rejects.toThrow("OPENWA_API_URL")
    })

    it("lança se OPENWA_API_KEY não estiver definido ao chamar método", async () => {
      delete process.env.OPENWA_API_KEY
      globalThis.fetch = mock(async () => jsonResponse({})) as unknown as typeof fetch
      await expect(new OpenWaApiService().startSession("x", "http://x")).rejects.toThrow("OPENWA_API_KEY")
    })
  })
})
