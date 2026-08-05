import { describe, expect, it } from "bun:test"
import { sanitizePublicFormOrigin } from "./origin"

describe("sanitizePublicFormOrigin", () => {
  it("remove query strings, fragmentos e tokens com possível PII", () => {
    expect(
      sanitizePublicFormOrigin({
        source: "instagram",
        utmCampaign: "pessoa@example.com",
        landingUrl: "https://example.com/forms/abc?email=pessoa@example.com#dados",
        referrer: "https://social.example/post/1?phone=11999999999",
      }),
    ).toEqual({
      source: "instagram",
      landingUrl: "https://example.com/forms/abc",
      referrer: "https://social.example/post/1",
    })
  })

  it("preserva recipientEmail válido (E1 — resolução Radar sem Lead)", () => {
    expect(
      sanitizePublicFormOrigin({
        emailLogId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        recipientEmail: "  Destinatario@Exemplo.COM ",
        utmCampaign: "campanha@leak.com",
      }),
    ).toEqual({
      emailLogId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      recipientEmail: "destinatario@exemplo.com",
    })
  })

  it("rejeita recipientEmail inválido", () => {
    expect(sanitizePublicFormOrigin({ recipientEmail: "nao-e-email" })).toEqual({})
  })

  it("ignora URLs inválidas", () => {
    expect(sanitizePublicFormOrigin({ landingUrl: "não é url" })).toEqual({})
  })
})
