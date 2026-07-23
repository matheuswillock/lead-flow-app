import { describe, expect, it } from "bun:test"
import { shouldApplyOutboundMessageStatus } from "./outbound-message-status"

describe("outbound message status reducer", () => {
  it("allows SENT → DELIVERED → READ", () => {
    expect(shouldApplyOutboundMessageStatus("SENT", "DELIVERED")).toBe(true)
    expect(shouldApplyOutboundMessageStatus("DELIVERED", "READ")).toBe(true)
  })

  it("does not regress a later receipt", () => {
    expect(shouldApplyOutboundMessageStatus("READ", "DELIVERED")).toBe(false)
    expect(shouldApplyOutboundMessageStatus("DELIVERED", "SENT")).toBe(false)
  })

  it("does not replace delivery proof with a delayed failure", () => {
    expect(shouldApplyOutboundMessageStatus("DELIVERED", "FAILED")).toBe(false)
    expect(shouldApplyOutboundMessageStatus("READ", "FAILED")).toBe(false)
    expect(shouldApplyOutboundMessageStatus("PLAYED", "FAILED")).toBe(false)
  })

  it("only promotes an audio receipt to PLAYED after READ", () => {
    expect(shouldApplyOutboundMessageStatus("READ", "PLAYED")).toBe(true)
    expect(shouldApplyOutboundMessageStatus("PLAYED", "READ")).toBe(false)
  })

  it("keeps UNKNOWN until a reliable receipt arrives", () => {
    expect(shouldApplyOutboundMessageStatus("UNKNOWN", "SENT")).toBe(false)
    expect(shouldApplyOutboundMessageStatus("UNKNOWN", "DELIVERED")).toBe(true)
  })
})
