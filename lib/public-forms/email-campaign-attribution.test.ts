import { describe, expect, it } from "bun:test"
import {
  extractPhoneFromCustomFields,
  parseEmailLogIdFromOrigin,
  parseRecipientEmailFromOrigin,
  resolveAttributionDisplayName,
} from "./email-campaign-attribution"

describe("email-campaign-attribution", () => {
  it("aceita emailLogId UUID no origin", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    expect(parseEmailLogIdFromOrigin({ emailLogId: id })).toBe(id)
    expect(parseEmailLogIdFromOrigin({ cs_el: id })).toBe(id)
  })

  it("rejeita token inválido", () => {
    expect(parseEmailLogIdFromOrigin({ emailLogId: "not-a-uuid" })).toBeNull()
    expect(parseEmailLogIdFromOrigin({})).toBeNull()
  })

  it("parseia recipientEmail do origin (E1)", () => {
    expect(parseRecipientEmailFromOrigin({ recipientEmail: "  Ana@X.com " })).toBe("ana@x.com")
    expect(parseRecipientEmailFromOrigin({ recipientEmail: "invalido" })).toBeNull()
    expect(parseRecipientEmailFromOrigin({})).toBeNull()
  })

  it("extrai telefone de customFields", () => {
    expect(extractPhoneFromCustomFields({ telefone: "11999998888" })).toBe("11999998888")
    expect(extractPhoneFromCustomFields({ foo: "bar" })).toBeNull()
  })

  it("resolve nome com fallback do e-mail", () => {
    expect(resolveAttributionDisplayName("Ana", "ana@x.com")).toBe("Ana")
    expect(resolveAttributionDisplayName(null, "ana@x.com")).toBe("ana")
  })
})
