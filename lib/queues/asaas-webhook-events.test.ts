import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { AsaasWebhookBody } from "@/app/api/webhooks/asaas/processAsaasWebhookEvent"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishAsaasWebhookEvent,
  ASAAS_WEBHOOK_EVENTS_TOPIC,
  ASAAS_WEBHOOK_EVENTS_RETENTION_SECONDS,
} = await import("./asaas-webhook-events")

const baseBody: AsaasWebhookBody = {
  id: "evt-asaas-1",
  event: "PAYMENT_RECEIVED",
  payment: {
    id: "pay-1",
    status: "RECEIVED",
    externalReference: "ext-1",
  },
}

const basePayload = {
  eventId: "evt-asaas-1",
  body: baseBody,
}

describe("publishAsaasWebhookEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com payload completo, idempotencyKey = eventId e retenção de 7 dias", async () => {
    const result = await publishAsaasWebhookEvent(basePayload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof basePayload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(ASAAS_WEBHOOK_EVENTS_TOPIC)
    expect(call[1]).toEqual(basePayload)
    expect(call[2]).toEqual({
      idempotencyKey: "evt-asaas-1",
      retentionSeconds: ASAAS_WEBHOOK_EVENTS_RETENTION_SECONDS,
    })
  })

  it("retorna { messageId } do resultado do send", async () => {
    send.mockResolvedValue({ messageId: "mid-queued" })
    const result = await publishAsaasWebhookEvent(basePayload)
    expect(result).toEqual({ messageId: "mid-queued" })
  })
})
