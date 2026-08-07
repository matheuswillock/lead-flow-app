import { describe, expect, it, mock } from "bun:test"
import { ProcessOpenWaWebhookUseCase } from "./ProcessOpenWaWebhookUseCase"
import type { IWhatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/IWhatsAppRepository"

function buildRepo(overrides: Record<string, unknown> = {}): IWhatsAppRepository {
  return {
    updateConfig: mock(async () => ({})),
    findConfigById: mock(async () => ({ id: "cfg-1", qrCodeText: null })),
    findConversationByExternalChatId: mock(async () => null),
    findOrCreateConversation: mock(async () => ({ id: "conv-1", contactName: null, contactId: null })),
    createMessage: mock(async () => ({ id: "msg-1" })),
    updateConversation: mock(async () => ({})),
    findMessageByProviderMessageId: mock(async () => null),
    updateMessageStatus: mock(async () => ({})),
    ...overrides,
  } as unknown as IWhatsAppRepository
}

describe("ProcessOpenWaWebhookUseCase", () => {
  it("qr → atualiza config QR_READY", async () => {
    const updateConfig = mock(async () => ({}))
    const uc = new ProcessOpenWaWebhookUseCase(buildRepo({ updateConfig }))
    const output = await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: { instance: "i", event: "qr", data: { qr: "QRCODE" }, timestamp: 1 },
    })
    expect(output.isValid).toBe(true)
    expect(updateConfig).toHaveBeenCalledWith(
      "cfg-1",
      expect.objectContaining({ status: "QR_READY" })
    )
  })

  it("ready → CONNECTED", async () => {
    const updateConfig = mock(async () => ({}))
    const uc = new ProcessOpenWaWebhookUseCase(buildRepo({ updateConfig }))
    await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: { instance: "i", event: "ready", data: {}, timestamp: 1 },
    })
    expect(updateConfig).toHaveBeenCalledWith(
      "cfg-1",
      expect.objectContaining({ status: "CONNECTED", qrCodeText: null, qrCodeImageUrl: null })
    )
  })

  it("disconnected → DISCONNECTED", async () => {
    const updateConfig = mock(async () => ({}))
    const uc = new ProcessOpenWaWebhookUseCase(buildRepo({ updateConfig }))
    await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: { instance: "i", event: "disconnected", data: { reason: "x" }, timestamp: 1 },
    })
    expect(updateConfig).toHaveBeenCalledWith(
      "cfg-1",
      expect.objectContaining({ status: "DISCONNECTED" })
    )
  })

  it("message inbound cria conversa+mensagem", async () => {
    const findOrCreateConversation = mock(async () => ({
      id: "conv-1",
      contactName: null,
      contactId: null,
    }))
    const createMessage = mock(async () => ({ id: "msg-1" }))
    const uc = new ProcessOpenWaWebhookUseCase(
      buildRepo({ findOrCreateConversation, createMessage })
    )
    const output = await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: {
        instance: "i",
        event: "message",
        data: {
          id: { _serialized: "true_5511999999999@c.us_ABC" },
          from: "5511999999999@c.us",
          body: "Oi",
          fromMe: false,
          timestamp: 1700000000,
          hasMedia: false,
          notifyName: "Ana",
        },
        timestamp: 1,
      },
    })
    expect(output.isValid).toBe(true)
    expect(findOrCreateConversation).toHaveBeenCalled()
    expect(createMessage).toHaveBeenCalled()
  })

  it("message_ack atualiza status outbound", async () => {
    const updateMessageStatus = mock(async () => ({}))
    const findMessageByProviderMessageId = mock(async () => ({
      id: "msg-1",
      direction: "OUTBOUND",
      status: "SENT",
    }))
    const uc = new ProcessOpenWaWebhookUseCase(
      buildRepo({ updateMessageStatus, findMessageByProviderMessageId })
    )
    const output = await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: {
        instance: "i",
        event: "message_ack",
        data: { id: "msg-1", ack: 3 },
        timestamp: 1,
      },
    })
    expect(output.isValid).toBe(true)
    expect(updateMessageStatus).toHaveBeenCalled()
  })

  it("payload inválido → Output inválido não-retryable", async () => {
    const uc = new ProcessOpenWaWebhookUseCase(buildRepo())
    const output = await uc.execute({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: { foo: "bar" },
    })
    expect(output.isValid).toBe(false)
    expect(output.result?.retryable).toBe(false)
  })
})
