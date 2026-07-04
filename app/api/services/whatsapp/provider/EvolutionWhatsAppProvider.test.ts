import { describe, expect, it, mock } from "bun:test"
import { EvolutionWhatsAppProvider } from "./EvolutionWhatsAppProvider"
import type { IEvoApiService } from "../evo/IEvoApiService"

function buildEvoStub(overrides: Partial<IEvoApiService> = {}): IEvoApiService {
  const notImplemented = () => {
    throw new Error("não esperado neste teste")
  }
  return {
    createInstance: mock(notImplemented),
    adoptOrCreateInstance: mock(notImplemented),
    setWebhook: mock(notImplemented),
    getQrCode: mock(notImplemented),
    getConnectionState: mock(notImplemented),
    fetchInstance: mock(notImplemented),
    findChats: mock(notImplemented),
    findMessages: mock(notImplemented),
    fetchProfilePictureUrl: mock(notImplemented),
    sendTextMessage: mock(notImplemented),
    sendMediaMessage: mock(notImplemented),
    getBase64FromMediaMessage: mock(notImplemented),
    findContacts: mock(notImplemented),
    findGroupParticipants: mock(notImplemented),
    disconnectInstance: mock(notImplemented),
    deleteInstance: mock(notImplemented),
    ...overrides,
  } as IEvoApiService
}

describe("EvolutionWhatsAppProvider", () => {
  it("connectInstance mapeia adoptOrCreateInstance para o contrato neutro", async () => {
    const adoptOrCreateInstance = mock(async () => ({
      instanceName: "team_abc",
      instanceId: "inst-1",
      status: "connecting" as const,
      qrCode: { text: "qr-text", base64: "qr-b64" },
      adopted: true,
    }))
    const provider = new EvolutionWhatsAppProvider(buildEvoStub({ adoptOrCreateInstance }))

    const result = await provider.connectInstance({
      instanceName: "team_abc",
      webhookUrl: "https://app.test/webhook/x",
      hostBaseUrl: "https://evo.test",
    })

    expect(adoptOrCreateInstance).toHaveBeenCalledWith({
      instanceName: "team_abc",
      webhookUrl: "https://app.test/webhook/x",
      hostBaseUrl: "https://evo.test",
    })
    expect(result).toEqual({
      instanceName: "team_abc",
      instanceId: "inst-1",
      status: "connecting",
      qrCode: { text: "qr-text", base64: "qr-b64" },
      adopted: true,
    })
  })

  it("sendText delega para sendTextMessage preservando parâmetros e retorno", async () => {
    const sendTextMessage = mock(async () => ({
      providerMessageId: "msg-1",
      status: "PENDING",
      messageKey: { id: "msg-1" },
    }))
    const provider = new EvolutionWhatsAppProvider(buildEvoStub({ sendTextMessage }))

    const result = await provider.sendText({
      instanceName: "team_abc",
      recipientJid: "5511999999999@s.whatsapp.net",
      text: "Olá",
      linkPreview: true,
    })

    expect(sendTextMessage).toHaveBeenCalledWith({
      instanceName: "team_abc",
      recipientJid: "5511999999999@s.whatsapp.net",
      text: "Olá",
      linkPreview: true,
    })
    expect(result.providerMessageId).toBe("msg-1")
    expect(result.messageKey).toEqual({ id: "msg-1" })
  })

  it("delegações diretas: getInstanceInfo/fetchChats/fetchMessagesSince/resolveMediaBase64/disconnect", async () => {
    const since = new Date("2026-07-01T00:00:00Z")
    const fetchInstance = mock(async () => ({
      instanceName: "team_abc",
      owner: "5511988887777@s.whatsapp.net",
      profileName: "Time",
    }))
    const findChats = mock(async () => [])
    const findMessages = mock(async () => [])
    const getBase64FromMediaMessage = mock(async () => ({ base64: "b64", mimeType: "image/jpeg" }))
    const disconnectInstance = mock(async () => {})

    const provider = new EvolutionWhatsAppProvider(
      buildEvoStub({
        fetchInstance,
        findChats,
        findMessages,
        getBase64FromMediaMessage,
        disconnectInstance,
      })
    )

    await expect(provider.getInstanceInfo("team_abc", "https://evo.test")).resolves.toMatchObject({
      profileName: "Time",
    })
    await expect(provider.fetchChats("team_abc")).resolves.toEqual([])
    await provider.fetchMessagesSince({ instanceName: "team_abc", remoteJid: "x@s.whatsapp.net", since })
    expect(findMessages).toHaveBeenCalledWith({
      instanceName: "team_abc",
      remoteJid: "x@s.whatsapp.net",
      since,
    })
    await expect(
      provider.resolveMediaBase64({ instanceName: "team_abc", messageKey: { id: "m1" } })
    ).resolves.toEqual({ base64: "b64", mimeType: "image/jpeg" })
    await provider.disconnect("team_abc")
    expect(disconnectInstance).toHaveBeenCalledWith("team_abc", undefined)
  })
})
