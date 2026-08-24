import { describe, expect, it } from "bun:test"
import {
  buildAttributionEventKeySuffix,
  isEmailCampaignFormOrigin,
  sanitizePublicFormOrigin,
} from "./origin"

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

  it("escopa o eventKey por emailLogId — só com UUID válido", () => {
    const emailLogId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    expect(buildAttributionEventKeySuffix(emailLogId)).toBe(`:el:${emailLogId}`)
    expect(buildAttributionEventKeySuffix(` ${emailLogId} `)).toBe(`:el:${emailLogId}`)

    // Visita direta mantém a chave antiga — não recria histórico à toa.
    expect(buildAttributionEventKeySuffix(null)).toBe("")
    expect(buildAttributionEventKeySuffix(undefined)).toBe("")
    expect(buildAttributionEventKeySuffix("")).toBe("")
    expect(buildAttributionEventKeySuffix("   ")).toBe("")

    // Valor forjado não entra na chave: o cs_el vem da URL, é entrada de usuário.
    expect(buildAttributionEventKeySuffix("../../etc/passwd")).toBe("")
    expect(buildAttributionEventKeySuffix("nao-e-uuid")).toBe("")
  })

  it("detecta origem de campanha de e-mail", () => {
    expect(isEmailCampaignFormOrigin({ emailLogId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })).toBe(true)
    expect(isEmailCampaignFormOrigin({ source: "email_campaign" })).toBe(true)
    expect(isEmailCampaignFormOrigin({ attribution: "email_campaign" })).toBe(true)
    expect(isEmailCampaignFormOrigin({ campaignId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" })).toBe(false)
    expect(isEmailCampaignFormOrigin({ source: "instagram" })).toBe(false)
    expect(isEmailCampaignFormOrigin({})).toBe(false)
  })
})
