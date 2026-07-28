import { describe, expect, it } from "bun:test"
import { resolveContactIdentity } from "./ContactIdentityResolver"

describe("ContactIdentityResolver isolation", () => {
  it("não deriva telefone de @lid", () => {
    const resolved = resolveContactIdentity("123456789012345@lid")
    expect(resolved.kind).toBe("LID")
    expect(resolved.phoneE164).toBeNull()
  })

  it("classifica phone JID como E.164", () => {
    const resolved = resolveContactIdentity("5511999999999@s.whatsapp.net")
    expect(resolved.kind).toBe("PHONE")
    if (resolved.kind === "PHONE") {
      expect(resolved.phoneE164).toBe("+5511999999999")
    }
  })

  it("ignora grupos no cadastro pessoal", () => {
    expect(resolveContactIdentity("120363@g.us").kind).toBe("GROUP")
  })
})
