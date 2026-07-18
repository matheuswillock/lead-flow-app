import { describe, expect, it } from "bun:test"
import { shouldWipeInboxOnPhoneChange } from "./should-wipe-inbox-on-phone-change"

describe("shouldWipeInboxOnPhoneChange", () => {
  it("não limpa na primeira conexão (previous null)", () => {
    expect(shouldWipeInboxOnPhoneChange(null, "5511999999999")).toBe(false)
    expect(shouldWipeInboxOnPhoneChange(undefined, "5511999999999")).toBe(false)
  })

  it("não limpa quando o mesmo número reconecta", () => {
    expect(shouldWipeInboxOnPhoneChange("5511999999999", "5511999999999")).toBe(false)
  })

  it("limpa quando o número conectado é diferente do último", () => {
    expect(shouldWipeInboxOnPhoneChange("5511888888888", "5511999999999")).toBe(true)
  })
})
