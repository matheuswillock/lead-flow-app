import { describe, expect, it, spyOn } from "bun:test"
import { resolveTransactionalQuotaFailure } from "@/lib/email/resend-quota-incident"

/**
 * T-C4.3 — a auditoria contou 159 estouros de cota em transacional
 * (`forgot-password`, lembrete de documento, follow-up de reunião). Recuperar
 * senha sem e-mail é P0 de suporte, e o erro não pode morrer dentro do
 * `EmailService`: sobe marcado, para o chamador poder decidir.
 *
 * O teste ataca `resolveTransactionalQuotaFailure` — a decisão real que o
 * `sendEmailDirect` executa nos dois caminhos de erro (resposta com `error` e
 * exceção). Importar o `EmailService` aqui seria frágil de propósito errado:
 * vários arquivos de teste substituem esse módulo com `mock.module`, e a
 * importação quebraria conforme a ordem de execução do `bun test`.
 */
describe("Cota mensal no transacional (T-C4.3)", () => {
  const QUOTA_ERROR = {
    name: "monthly_quota_exceeded",
    message: "You have exceeded your monthly email sending quota.",
  }

  it("erro de cota devolve a tag para o chamador e emite o incidente", () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {})

    try {
      const outcome = resolveTransactionalQuotaFailure(QUOTA_ERROR, {
        teamId: "team-1",
        category: "forgot-password",
      })

      expect(outcome.errorTag).toBe("resend_monthly_quota_exceeded")

      const quotaLog = consoleError.mock.calls.find(
        (call) => call[0] === "[resend_monthly_quota_exceeded]"
      )
      expect(quotaLog?.[1]).toMatchObject({
        tag: "resend_monthly_quota_exceeded",
        surface: "transactional",
        category: "forgot-password",
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it("erro comum do provedor não vira incidente nem ganha tag", () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {})

    try {
      const outcome = resolveTransactionalQuotaFailure(
        { name: "validation_error", message: "Invalid `to` field." },
        { teamId: "team-1", category: "meeting-follow-up" }
      )

      expect(outcome.errorTag).toBeUndefined()
      expect(
        consoleError.mock.calls.some((call) => call[0] === "[resend_monthly_quota_exceeded]")
      ).toBe(false)
    } finally {
      consoleError.mockRestore()
    }
  })

  it("reconhece a cota pela mensagem quando o provedor não manda o name", () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {})

    try {
      const outcome = resolveTransactionalQuotaFailure(
        { message: "You have exceeded your monthly email sending quota." },
        { teamId: null, category: "document-request-reminder" }
      )

      expect(outcome.errorTag).toBe("resend_monthly_quota_exceeded")
    } finally {
      consoleError.mockRestore()
    }
  })
})
