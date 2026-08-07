import { describe, expect, it, mock } from "bun:test"

const claimWebhookEvent = mock(async () => ({
  id: "evt-1",
  teamId: "team-1",
  configId: "cfg-1",
  attemptCount: 1,
  payload: { event: "ready" },
}))
const completeWebhookEvent = mock(async () => {})
const processOpenWa = mock(async () => ({
  isValid: true,
  errorMessages: [] as string[],
  successMessages: [] as string[],
  result: { processed: true },
}))

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    claimWebhookEvent,
    completeWebhookEvent,
    listPendingWebhookEventIds: mock(async () => []),
    reconcileStaleOutboundCommands: mock(async () => 0),
  },
}))

mock.module("./ProcessOpenWaWebhookUseCase", () => ({
  processOpenWaWebhookUseCase: { execute: processOpenWa },
}))

mock.module("@/lib/whatsapp/slo-metrics", () => ({
  emitWhatsAppSloMetric: mock(() => {}),
}))

const { processWhatsAppWebhookOutboxUseCase } = await import(
  "./ProcessWhatsAppWebhookOutboxUseCase"
)

describe("ProcessWhatsAppWebhookOutboxUseCase", () => {
  it("processa eventos via ProcessOpenWaWebhookUseCase", async () => {
    processOpenWa.mockClear()
    await processWhatsAppWebhookOutboxUseCase.process("evt-1")
    expect(processOpenWa).toHaveBeenCalledWith({
      teamId: "team-1",
      configId: "cfg-1",
      rawEvent: { event: "ready" },
    })
  })
})
