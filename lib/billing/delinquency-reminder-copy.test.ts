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

  test("aviso do início da carência diz que o acesso segue completo, até quando, e o que a renovação mostra", () => {
    const copy = getDelinquencyReminderCopy("grace_started", { graceUntilLabel: "10/12/2026" })

    expect(copy.subject).toBe("Corretor Studio — O período do seu plano está se encerrando")
    expect(copy.bodyText).toContain("acesso completo até 10/12/2026")
    expect(copy.bodyText).toContain("mensal, trimestral, semestral ou anual")
    expect(copy.bodyText).toContain("usuários e times adicionais")
  })

  test("aviso do último dia da carência avisa do modo somente leitura", () => {
    const copy = getDelinquencyReminderCopy("grace_last_day", { graceUntilLabel: "10/12/2026" })

    expect(copy.headline).toBe("Último dia antes do modo somente leitura")
    expect(copy.bodyText).toContain("último dia do período de carência (até 10/12/2026)")
    expect(copy.bodyText).toContain("somente leitura")
  })

  test("sem a data, o aviso da carência ainda faz sentido", () => {
    expect(getDelinquencyReminderCopy("grace_started").bodyText).toContain("até o fim da carência")
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
