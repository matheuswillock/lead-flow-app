import { describe, expect, it } from "bun:test"
import { EmailCreditService } from "./EmailCreditService"

describe("EmailCreditService", () => {
  const service = new EmailCreditService()

  it("formata mensagem de créditos insuficientes em PT-BR", () => {
    const message = service.formatInsufficientCreditsMessage(378, 0)
    expect(message).toContain("378")
    expect(message).toContain("Saldo: 0")
  })
})
