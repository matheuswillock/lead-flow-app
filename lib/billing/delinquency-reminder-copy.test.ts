import { describe, expect, test } from "bun:test"
import { getDelinquencyReminderCopy } from "./delinquency-reminder-copy"

describe("getDelinquencyReminderCopy", () => {
  test("degrau de somente leitura (dias 6 a 15) não diz que o acesso está pausado", () => {
    const copy = getDelinquencyReminderCopy("crm_only")

    expect(copy.subject).toBe("Corretor Studio — Sua conta está em modo somente leitura")
    expect(copy.headline).toBe("Sua conta está em modo somente leitura")
    expect(copy.bodyText).toContain("só pode visualizar o CRM e a Carteira")
    expect(copy.bodyText).toContain("Regularize o pagamento")
    expect(copy.bodyText).toContain("o acesso é pausado por completo")
    expect(`${copy.subject} ${copy.headline}`).not.toContain("pausado")
  })

  test("degrau de corte (dia 16 em diante) avisa que o acesso está pausado e manda pagar", () => {
    const copy = getDelinquencyReminderCopy("cut_off")

    expect(copy.subject).toBe("Corretor Studio — Acesso pausado por falta de pagamento")
    expect(copy.headline).toBe("Seu acesso está pausado")
    expect(copy.bodyText).toContain("acesso à plataforma está pausado")
    expect(copy.bodyText).toContain("Regularize o pagamento para reativar")
  })

  test("os dois degraus têm texto diferente", () => {
    expect(getDelinquencyReminderCopy("crm_only")).not.toEqual(getDelinquencyReminderCopy("cut_off"))
  })

  test("nenhum degrau manda o cliente falar com o time de assinaturas para pagar", () => {
    for (const tier of ["crm_only", "cut_off"] as const) {
      expect(getDelinquencyReminderCopy(tier).bodyText).not.toContain("time de assinaturas")
    }
  })
})
