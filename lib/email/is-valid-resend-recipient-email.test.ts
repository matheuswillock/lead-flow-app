import { describe, expect, it } from "bun:test"
import {
  formatInvalidRecipientFailureMessage,
  formatProviderBatchFailureMessage,
  isValidResendRecipientEmail,
} from "./is-valid-resend-recipient-email"

describe("isValidResendRecipientEmail", () => {
  it("aceita e-mails válidos", () => {
    expect(isValidResendRecipientEmail("contato@liorseguros.com")).toEqual({
      ok: true,
      email: "contato@liorseguros.com",
    })
    expect(isValidResendRecipientEmail("  Carol.O@Example.COM  ")).toEqual({
      ok: true,
      email: "carol.o@example.com",
    })
    expect(isValidResendRecipientEmail("o'connor@example.com")).toEqual({
      ok: true,
      email: "o'connor@example.com",
    })
    expect(isValidResendRecipientEmail("sales!ops@example.com")).toEqual({
      ok: true,
      email: "sales!ops@example.com",
    })
  })

  it("rejeita os casos reais com pipe (múltiplos endereços)", () => {
    expect(
      isValidResendRecipientEmail("carol.ocipriani@gmail.com|hugopoli@gmail.com")
    ).toEqual({
      ok: false,
      reason: "E-mail com múltiplos endereços",
    })
    expect(
      isValidResendRecipientEmail(
        "financeiro@newcorban.com.br|financeiro@grupodigital.com.br"
      )
    ).toEqual({
      ok: false,
      reason: "E-mail com múltiplos endereços",
    })
  })

  it("rejeita ausente, espaços, separadores e formato inválido", () => {
    expect(isValidResendRecipientEmail("")).toEqual({
      ok: false,
      reason: "E-mail ausente",
    })
    expect(isValidResendRecipientEmail("a b@c.com")).toEqual({
      ok: false,
      reason: "E-mail contém espaços",
    })
    expect(isValidResendRecipientEmail("a@b.com;c@d.com")).toEqual({
      ok: false,
      reason: "E-mail com múltiplos endereços",
    })
    expect(isValidResendRecipientEmail("Name <a@b.com>")).toEqual({
      ok: false,
      reason: "E-mail contém espaços",
    })
    expect(isValidResendRecipientEmail("<a@b.com>")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
    expect(isValidResendRecipientEmail("sem-arroba")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
    expect(isValidResendRecipientEmail("@sem-local.com")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
  })

  it("rejeita local-part com ponto no início, fim ou consecutivo (caso Resend 422)", () => {
    expect(isValidResendRecipientEmail("mjc.f.@terra.com.br")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
    expect(isValidResendRecipientEmail(".mjc@terra.com.br")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
    expect(isValidResendRecipientEmail("mjc..f@terra.com.br")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
  })
})

describe("format helpers", () => {
  it("formata falha local de destinatário", () => {
    expect(
      formatInvalidRecipientFailureMessage(
        "a@b.com|c@d.com",
        "E-mail com múltiplos endereços"
      )
    ).toBe(
      "E-mail inválido para o Resend: a@b.com|c@d.com (E-mail com múltiplos endereços)"
    )
  })

  it("formata falha de lote do provedor com amostra de e-mails", () => {
    const emails = Array.from({ length: 12 }, (_, i) => `r${i}@test.com`)
    expect(
      formatProviderBatchFailureMessage({
        message: "Invalid `to` field",
        statusCode: 422,
        emails,
        sampleLimit: 10,
      })
    ).toBe(
      "422 — Invalid `to` field. Destinatários do lote: r0@test.com, r1@test.com, r2@test.com, r3@test.com, r4@test.com, r5@test.com, r6@test.com, r7@test.com, r8@test.com, r9@test.com e mais 2."
    )
  })

  it("espelha a mensagem real do Resend 422 Invalid `to`", () => {
    const message =
      "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
    const emails = [
      "carol.ocipriani@gmail.com|hugopoli@gmail.com",
      "financeiro@newcorban.com.br|financeiro@grupodigital.com.br",
    ]
    const formatted = formatProviderBatchFailureMessage({
      message,
      statusCode: 422,
      emails,
    })
    expect(formatted).toContain("422 —")
    expect(formatted).toContain("Invalid `to` field")
    expect(formatted).toContain("carol.ocipriani@gmail.com|hugopoli@gmail.com")
    expect(formatted).toContain("financeiro@newcorban.com.br|financeiro@grupodigital.com.br")
  })
})
