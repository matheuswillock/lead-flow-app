import { describe, expect, it } from "bun:test"
import { EmailContactListService } from "./EmailContactListService"

describe("EmailContactListService.parseCsv — validação Resend", () => {
  const service = new EmailContactListService()

  it("descarta linhas com e-mail pipe (casos reais que geraram 422)", () => {
    const csv = [
      "email,nome",
      "lior@liorseguros.com,Lior",
      "carol.ocipriani@gmail.com|hugopoli@gmail.com,Carol",
      "financeiro@newcorban.com.br|financeiro@grupodigital.com.br,Financeiro",
      "ok@example.com,Ok",
    ].join("\n")

    const contacts = service.parseCsv(csv)

    expect(contacts).toHaveLength(2)
    expect(contacts.map((contact) => contact.email)).toEqual([
      "lior@liorseguros.com",
      "ok@example.com",
    ])
  })

  it("retorna vazio quando o CSV só tem e-mails inválidos", () => {
    const csv = [
      "email,nome",
      "carol.ocipriani@gmail.com|hugopoli@gmail.com,Carol",
      "a@b.com;c@d.com,Duplo",
    ].join("\n")

    expect(service.parseCsv(csv)).toEqual([])
  })

  it("descarta typo, ISP morto e role; mantém Terra", () => {
    const csv = [
      "email,nome",
      "ana@gamil.com,Ana",
      "ana@ig.com.br,Ig",
      "contato@empresa.com,Role",
      "ana@terra.com.br,Terra",
    ].join("\n")

    expect(service.parseCsv(csv).map((contact) => contact.email)).toEqual(["ana@terra.com.br"])
  })
})

describe("EmailContactListService.parseCsvWithIssues — drop silencioso corrigido", () => {
  const service = new EmailContactListService()

  it("linha sem e-mail vira issue com a linha REAL do arquivo, nunca descarte mudo", () => {
    const csv = [
      "email,nome",
      "ok@example.com,Ok",
      ",SemEmail",
      "outro@example.com,Outro",
    ].join("\n")

    const parsed = service.parseCsvWithIssues(csv)

    expect(parsed.contacts.map((contact) => contact.email)).toEqual([
      "ok@example.com",
      "outro@example.com",
    ])
    // Header é a linha 1; a linha vazia é a 3ª do arquivo.
    expect(parsed.issues).toEqual([
      { line: 3, email: "(vazio)", reason: "E-mail ausente na linha" },
    ])
    expect(parsed.contacts[0]?.line).toBe(2)
    expect(parsed.contacts[1]?.line).toBe(4)
  })

  it("e-mail sintaticamente inválido SEGUE no fluxo — classificação é papel do gate", () => {
    const csv = [
      "email,nome",
      "carol@gmail.com|hugo@gmail.com,Carol",
      "ok@example.com,Ok",
    ].join("\n")

    const parsed = service.parseCsvWithIssues(csv)

    // O parser não descarta: o gate de importação classifica e reporta.
    expect(parsed.contacts.map((contact) => contact.email)).toEqual([
      "carol@gmail.com|hugo@gmail.com",
      "ok@example.com",
    ])
    expect(parsed.issues).toEqual([])
  })

  it("continua exigindo a coluna de e-mail", () => {
    expect(() => service.parseCsvWithIssues("nome\nAna")).toThrow(
      "CSV deve conter uma coluna de email"
    )
  })

  it("preserva customFields e nome no shape com linhas", () => {
    const csv = ["email,nome,cidade", "ana@example.com,Ana,Recife"].join("\n")

    const parsed = service.parseCsvWithIssues(csv)

    expect(parsed.contacts).toEqual([
      {
        line: 2,
        email: "ana@example.com",
        name: "Ana",
        customFields: { cidade: "Recife" },
      },
    ])
  })
})
