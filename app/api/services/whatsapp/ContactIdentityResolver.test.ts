import { describe, expect, it } from "bun:test"
import { formatPhoneE164, resolveContactIdentity } from "./ContactIdentityResolver"

describe("ContactIdentityResolver", () => {
  it("normalizes supported phone JIDs to E.164", () => {
    expect(resolveContactIdentity("5511999999999@s.whatsapp.net")).toEqual({
      kind: "PHONE",
      remoteJid: "5511999999999@s.whatsapp.net",
      phoneE164: "+5511999999999",
    })
    expect(formatPhoneE164("+5511999999999")).toBe("+55 (11) 99999-9999")
  })

  it("never turns a LID into a phone number", () => {
    expect(resolveContactIdentity("123456789@lid")).toEqual({
      kind: "LID",
      remoteJid: "123456789@lid",
      phoneE164: null,
    })
  })

  it("does not create personal contacts from groups", () => {
    expect(resolveContactIdentity("120363000000000@g.us").kind).toBe("GROUP")
  })
})
