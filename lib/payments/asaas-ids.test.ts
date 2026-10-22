import { describe, expect, it } from "bun:test"
import { isRealAsaasSubscriptionId } from "./asaas-ids"

describe("isRealAsaasSubscriptionId", () => {
  it("rejeita vazio e ids sintéticos de adesão", () => {
    for (const id of [null, undefined, "", "adhesion-1", "external-adhesion-1"]) {
      expect(isRealAsaasSubscriptionId(id)).toBe(false)
    }
  })
  it("aceita ids do Asaas", () => {
    expect(isRealAsaasSubscriptionId("sub_123")).toBe(true)
  })
})
