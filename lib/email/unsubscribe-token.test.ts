import { describe, expect, it } from "bun:test"
import {
  generateEmailUnsubscribeToken,
  maskEmailForUnsubscribe,
  parseEmailUnsubscribeToken,
} from "./unsubscribe-token"

describe("unsubscribe-token", () => {
  it("gera e valida token opaco com campaignId", () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-key"
    const token = generateEmailUnsubscribeToken(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    )
    const parsed = parseEmailUnsubscribeToken(token)
    expect(parsed?.contactId).toBe("11111111-1111-1111-1111-111111111111")
    expect(parsed?.teamId).toBe("22222222-2222-2222-2222-222222222222")
    expect(parsed?.campaignId).toBe("33333333-3333-3333-3333-333333333333")
  })

  it("gera e valida token legado sem campaignId", () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-key"
    const token = generateEmailUnsubscribeToken(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222"
    )
    const parsed = parseEmailUnsubscribeToken(token)
    expect(parsed?.contactId).toBe("11111111-1111-1111-1111-111111111111")
    expect(parsed?.teamId).toBe("22222222-2222-2222-2222-222222222222")
    expect(parsed?.campaignId).toBeNull()
  })

  it("rejeita token adulterado", () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-key"
    const token = generateEmailUnsubscribeToken(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333"
    )
    const tampered = `${token}x`
    expect(parseEmailUnsubscribeToken(tampered)).toBeNull()
  })

  it("mascara e-mail para exibição", () => {
    expect(maskEmailForUnsubscribe("maria@exemplo.com")).toBe("m•••@exemplo.com")
  })
})
