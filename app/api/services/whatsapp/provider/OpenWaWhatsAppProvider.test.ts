import { describe, expect, it, mock } from "bun:test"
import { OpenWaWhatsAppProvider } from "./OpenWaWhatsAppProvider"
import type { IOpenWaApiService, OpenWaSessionStatus } from "../openwa/IOpenWaApiService"
import { WhatsAppProviderCapabilityError } from "./IWhatsAppProvider"

function buildOpenWaStub(overrides: Partial<IOpenWaApiService> = {}): IOpenWaApiService {
  const notImplemented = async () => {
    throw new Error("não esperado neste teste")
  }
  return {
    startSession: mock(notImplemented),
    getSessionStatus: mock(notImplemented),
    deleteSession: mock(notImplemented),
    sendText: mock(notImplemented),
    sendMedia: mock(notImplemented),
    markChatSeen: mock(notImplemented),
    fetchChats: mock(async () => []),
    fetchContacts: mock(async () => []),
    fetchMessagesSince: mock(async () => []),
    fetchGroupParticipants: mock(async () => []),
    ...overrides,
  }
}

describe("OpenWaWhatsAppProvider", () => {
  it("connectInstance chama startSession", async () => {
    const startSession = mock(async () => {})
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ startSession }))

    const result = await provider.connectInstance({
      instanceName: "team_abc",
      webhookUrl: "https://app.test/api/webhooks/whatsapp/openwa/tok",
    })

    expect(startSession).toHaveBeenCalledWith(
      "team_abc",
      "https://app.test/api/webhooks/whatsapp/openwa/tok"
    )
    expect(result.instanceName).toBe("team_abc")
    expect(result.status).toBe("connecting")
    expect(result.adopted).toBe(false)
  })

  it("getConnectionState mapeia CONNECTED → open", async () => {
    const getSessionStatus = mock(async (): Promise<OpenWaSessionStatus> => ({
      status: "CONNECTED",
    }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ getSessionStatus }))
    const info = await provider.getConnectionState("team_abc")
    expect(info).toEqual({ instanceName: "team_abc", state: "open" })
  })

  it("getConnectionState mapeia INITIALIZING → connecting", async () => {
    const getSessionStatus = mock(async (): Promise<OpenWaSessionStatus> => ({
      status: "INITIALIZING",
    }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ getSessionStatus }))
    const info = await provider.getConnectionState("team_abc")
    expect(info.state).toBe("connecting")
  })

  it("getQrCode retorna QR quando QR_READY", async () => {
    const getSessionStatus = mock(async (): Promise<OpenWaSessionStatus> => ({
      status: "QR_READY",
      qr: "qr-payload",
    }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ getSessionStatus }))
    const qr = await provider.getQrCode("team_abc")
    expect(qr.text).toBe("qr-payload")
    expect(qr.base64).toBe("qr-payload")
  })

  it("getQrCode lança quando não há QR", async () => {
    const getSessionStatus = mock(async (): Promise<OpenWaSessionStatus> => ({
      status: "DISCONNECTED",
    }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ getSessionStatus }))
    await expect(provider.getQrCode("team_abc")).rejects.toThrow()
  })

  it("sendText adapta recipientJid → to e retorna providerMessageId", async () => {
    const sendText = mock(async () => ({ messageId: "msg-1" }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ sendText }))
    const result = await provider.sendText({
      instanceName: "team_abc",
      recipientJid: "5511999999999@s.whatsapp.net",
      text: "Oi",
    })
    expect(sendText).toHaveBeenCalledWith("team_abc", "5511999999999@s.whatsapp.net", "Oi")
    expect(result.providerMessageId).toBe("msg-1")
  })

  it("sendMedia adapta params de domínio", async () => {
    const sendMedia = mock(async () => ({ messageId: "media-1" }))
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ sendMedia }))
    const result = await provider.sendMedia({
      instanceName: "team_abc",
      recipientJid: "5511@s.whatsapp.net",
      mediatype: "image",
      mimeType: "image/png",
      fileName: "a.png",
      base64: "abc",
      caption: "cap",
    })
    expect(sendMedia).toHaveBeenCalledWith("team_abc", {
      to: "5511@s.whatsapp.net",
      base64: "abc",
      mimetype: "image/png",
      filename: "a.png",
      caption: "cap",
    })
    expect(result.providerMessageId).toBe("media-1")
  })

  it("markMessagesAsRead deriva chatId do primeiro remoteJid", async () => {
    const markChatSeen = mock(async () => {})
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ markChatSeen }))
    await provider.markMessagesAsRead({
      instanceName: "team_abc",
      readMessages: [
        { remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "1" },
        { remoteJid: "5511@s.whatsapp.net", fromMe: false, id: "2" },
      ],
    })
    expect(markChatSeen).toHaveBeenCalledWith("team_abc", "5511@s.whatsapp.net")
  })

  it("disconnect chama deleteSession", async () => {
    const deleteSession = mock(async () => {})
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub({ deleteSession }))
    await provider.disconnect("team_abc")
    expect(deleteSession).toHaveBeenCalledWith("team_abc")
  })

  it("resolveMediaBase64 retorna null (media vem no webhook)", async () => {
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub())
    const result = await provider.resolveMediaBase64({
      instanceName: "x",
      messageKey: {},
    })
    expect(result).toBeNull()
  })

  it("métodos sem suporte no Gateway lançam WhatsAppProviderCapabilityError", async () => {
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub())
    await expect(provider.setWebhook({ instanceName: "x", webhookUrl: "u" })).rejects.toBeInstanceOf(
      WhatsAppProviderCapabilityError
    )
  })

  it("getMessageActionCapabilities desliga react/delete até o Gateway suportar", () => {
    const provider = new OpenWaWhatsAppProvider(buildOpenWaStub())
    expect(provider.getMessageActionCapabilities()).toEqual({
      reply: true,
      forward: true,
      react: false,
      deleteForEveryone: false,
    })
  })
})
