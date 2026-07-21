import { describe, expect, it } from "bun:test"
import { extractProviderEventId } from "./extract-provider-event-id"

describe("extractProviderEventId", () => {
  it("prioriza id explícito do envelope", () => {
    expect(extractProviderEventId({ id: "evt-123" }, "MESSAGES_UPSERT", "msg-1")).toBe("evt-123")
  })

  it("ignora id do envelope em batch e deriva por mensagem", () => {
    const rawEvent = { id: "evt-batch", instance: "inst-1", date_time: "2026-07-04T12:00:00Z" }
    expect(
      extractProviderEventId(rawEvent, "MESSAGES_UPSERT", "msg-1", { skipEnvelopeId: true })
    ).toBe("inst-1:2026-07-04T12:00:00Z:MESSAGES_UPSERT:msg-1")
    expect(
      extractProviderEventId(rawEvent, "MESSAGES_UPSERT", "msg-2", { skipEnvelopeId: true })
    ).toBe("inst-1:2026-07-04T12:00:00Z:MESSAGES_UPSERT:msg-2")
  })
})
