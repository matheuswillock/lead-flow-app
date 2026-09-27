import { describe, expect, it } from "bun:test"
import { buildDeliverabilityEvent } from "./EmailDeliverabilityEventPublisher"

describe("buildDeliverabilityEvent", () => {
  it("produces a stable idempotency key for the same operational event", () => {
    const input = {
      logId: "log-1",
      teamId: "team-1",
      occurredAt: new Date("2026-09-27T12:00:00.000Z"),
      eventType: "delivered" as const,
      senderDomain: "mail.example.com",
      recipientEmail: "person@gmail.com",
    }
    const first = buildDeliverabilityEvent(input)
    const second = buildDeliverabilityEvent(input)
    expect(first).not.toBeNull()
    expect(first).toEqual(second)
    expect(first?.type).toBe("delivered")
    expect(first?.recipientProvider).toBe("gmail.com")
  })

  it("ignores operational events that are not dashboard metrics", () => {
    expect(buildDeliverabilityEvent({
      logId: "log-1",
      teamId: "team-1",
      occurredAt: new Date(),
      eventType: "failed",
      senderDomain: "mail.example.com",
      recipientEmail: "person@gmail.com",
    })).toBeNull()
  })
})
