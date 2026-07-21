import { describe, expect, it } from "bun:test"
import { buildContactImportPreview } from "./buildContactImportPreview"

/** Casos reais encontrados em Corretoras Leads Bruno / SUB CONTATOS - BRUNO */
const REAL_INVALID_PIPE_EMAILS = [
  "carol.ocipriani@gmail.com|hugopoli@gmail.com",
  "financeiro@newcorban.com.br|financeiro@grupodigital.com.br",
] as const

describe("buildContactImportPreview — cenários de produção", () => {
  it("recusa os 2 e-mails com pipe que causaram 422 no Resend e importa os válidos", () => {
    const preview = buildContactImportPreview([
      { line: 1, email: "contato@liorseguros.com", name: "Lior" },
      { line: 2, email: REAL_INVALID_PIPE_EMAILS[0], name: "Carol/Hugo" },
      { line: 3, email: "ok@example.com.br", name: "Ok" },
      { line: 4, email: REAL_INVALID_PIPE_EMAILS[1], name: "Financeiro" },
    ])

    expect(preview.importableCount).toBe(2)
    expect(preview.skippedCount).toBe(2)
    expect(preview.skippedIssues).toEqual([
      {
        line: 2,
        email: REAL_INVALID_PIPE_EMAILS[0],
        reason: "E-mail com múltiplos endereços",
      },
      {
        line: 4,
        email: REAL_INVALID_PIPE_EMAILS[1],
        reason: "E-mail com múltiplos endereços",
      },
    ])
    expect(preview.preview.map((row) => row.email)).toEqual([
      "contato@liorseguros.com",
      "ok@example.com.br",
    ])
  })

  it("não importa arquivo só com e-mails inválidos (gate de importableCount=0)", () => {
    const preview = buildContactImportPreview(
      REAL_INVALID_PIPE_EMAILS.map((email, index) => ({
        line: index + 1,
        email,
      }))
    )

    expect(preview.importableCount).toBe(0)
    expect(preview.skippedCount).toBe(2)
    expect(preview.preview).toEqual([])
  })

  it("recusa separadores ; e , além de pipe", () => {
    const preview = buildContactImportPreview([
      { line: 1, email: "a@b.com;c@d.com" },
      { line: 2, email: "a@b.com,c@d.com" },
      { line: 3, email: "unico@valido.com" },
    ])

    expect(preview.importableCount).toBe(1)
    expect(preview.skippedCount).toBe(2)
    expect(preview.skippedIssues.every((issue) => issue.reason === "E-mail com múltiplos endereços")).toBe(
      true
    )
  })
})
