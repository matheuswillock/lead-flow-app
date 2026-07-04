import { describe, expect, it } from "bun:test"
import { extractProviderEventId } from "./extract-provider-event-id"

describe("extractProviderEventId", () => {
  it("prioriza id explícito do envelope", () => {
    expect(extractProviderEventId({ id: "evt-123" }, "MESSAGES_UPSERT", "msg-1")).toBe("evt-123")
  })
})
