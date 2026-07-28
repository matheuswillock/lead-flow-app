import { describe, expect, it, mock, beforeEach } from "bun:test"

const findOutboundCommand = mock(async (..._args: unknown[]) => null as unknown)
const createPendingOutboundMessageAndCommand = mock(async (..._args: unknown[]) => ({
  created: true,
  messageId: "msg-1",
  conversationId: "conv-1",
  requestHash: null,
}))
const retryFailedOutboundCommand = mock(async (..._args: unknown[]) => ({
  claimed: true,
  messageId: "msg-1",
}))
const completeOutboundCommand = mock(async (..._args: unknown[]) => undefined)
const failOutboundCommand = mock(async (..._args: unknown[]) => undefined)
const updateMessageStatus = mock(async (..._args: unknown[]) => undefined)

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    findOutboundCommand,
    createPendingOutboundMessageAndCommand,
    retryFailedOutboundCommand,
    completeOutboundCommand,
    failOutboundCommand,
    updateMessageStatus,
  },
}))

mock.module("@/app/api/services/whatsapp/WhatsAppConversationAccessService", () => ({
  assertCanAccessConversation: mock(async () => undefined),
  WhatsAppAccessDeniedError: class WhatsAppAccessDeniedError extends Error {},
}))

mock.module("@/lib/whatsapp/send-rate-limit", () => ({
  consumeSendRateLimit: mock(async () => true),
}))

const sendMessage = mock(async (..._args: unknown[]) => ({ messageId: "msg-1" }))
const getUsageSummary = mock(async () => ({ status: "OK" as const, used: 0, limit: 1000 }))

mock.module("@/app/api/services/whatsapp/WhatsAppService", () => ({
  whatsAppService: {
    sendMessage,
    getUsageSummary,
  },
}))

const { sendMessageUseCase } = await import("./SendMessageUseCase")

const access = {
  profileId: "profile-1",
  teamMember: { id: "tm-1", role: "MANAGER", teamId: "team-1" },
} as never

const baseInput = {
  teamId: "team-1",
  conversationId: "conv-1",
  contentText: "Olá",
  sentByProfileId: "profile-1",
  clientMessageId: "11111111-1111-4111-8111-111111111111",
  access,
}

describe("SendMessageUseCase idempotency", () => {
  beforeEach(() => {
    findOutboundCommand.mockReset()
    createPendingOutboundMessageAndCommand.mockReset()
    retryFailedOutboundCommand.mockReset()
    completeOutboundCommand.mockReset()
    failOutboundCommand.mockReset()
    updateMessageStatus.mockReset()
    sendMessage.mockReset()
    getUsageSummary.mockReset()
    getUsageSummary.mockResolvedValue({ status: "OK", used: 0, limit: 1000 })
    createPendingOutboundMessageAndCommand.mockResolvedValue({
      created: true,
      messageId: "msg-1",
      conversationId: "conv-1",
      requestHash: null,
    })
    sendMessage.mockResolvedValue({ messageId: "msg-1" })
  })

  it("replay SENT sem chamar o provider", async () => {
    findOutboundCommand.mockResolvedValue({
      conversationId: "conv-1",
      requestHash: null,
      status: "SENT",
      messageId: "msg-1",
    })
    const output = await sendMessageUseCase.execute(baseInput)
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ idempotentReplay: true, status: "SENT" })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("bloqueia UNKNOWN sem reenviar", async () => {
    findOutboundCommand.mockResolvedValue({
      conversationId: "conv-1",
      requestHash: null,
      status: "UNKNOWN",
      messageId: "msg-1",
    })
    const output = await sendMessageUseCase.execute(baseInput)
    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ status: "UNKNOWN", deliveryCertainty: "UNKNOWN" })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("exige retryFailed para FAILED", async () => {
    findOutboundCommand.mockResolvedValue({
      conversationId: "conv-1",
      requestHash: null,
      status: "FAILED",
      messageId: "msg-1",
    })
    const output = await sendMessageUseCase.execute(baseInput)
    expect(output.isValid).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("retry FAILED com retryFailed chama o provider", async () => {
    findOutboundCommand.mockResolvedValue({
      conversationId: "conv-1",
      requestHash: null,
      status: "FAILED",
      messageId: "msg-1",
    })
    retryFailedOutboundCommand.mockResolvedValue({ claimed: true, messageId: "msg-1" })
    createPendingOutboundMessageAndCommand.mockResolvedValue({
      created: false,
      messageId: "msg-1",
      conversationId: "conv-1",
      requestHash: null,
    })
    const output = await sendMessageUseCase.execute({ ...baseInput, retryFailed: true })
    expect(output.isValid).toBe(true)
    expect(retryFailedOutboundCommand).toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalled()
  })

  it("rejeita conflito de conteúdo (IDEMPOTENCY_CONFLICT)", async () => {
    findOutboundCommand.mockResolvedValue({
      conversationId: "conv-1",
      requestHash: "different-hash",
      status: "PENDING",
      messageId: "msg-1",
    })
    const output = await sendMessageUseCase.execute(baseInput)
    expect(output.isValid).toBe(false)
    expect(output.result).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" })
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
