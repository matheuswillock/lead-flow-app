import { describe, expect, it } from "bun:test"
import { EmailContactListService } from "./EmailContactListService"

describe("EmailContactListService.parseCsv — validação Resend", () => {
  const service = new EmailContactListService()

  it("descarta linhas com e-mail pipe (casos reais que geraram 422)", () => {
    const csv = [
      "email,nome",
      "contato@liorseguros.com,Lior",
      "carol.ocipriani@gmail.com|hugopoli@gmail.com,Carol",
      "financeiro@newcorban.com.br|financeiro@grupodigital.com.br,Financeiro",
      "ok@example.com,Ok",
    ].join("\n")

    const contacts = service.parseCsv(csv)

    expect(contacts).toHaveLength(2)
    expect(contacts.map((contact) => contact.email)).toEqual([
      "contato@liorseguros.com",
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
})
