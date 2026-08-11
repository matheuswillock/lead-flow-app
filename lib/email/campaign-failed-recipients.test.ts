import { describe, expect, it } from "bun:test"
import {
  resolveRetryRecipientEmails,
  selectFailedRecipientEmailsForRetry,
  type CampaignFailedRecipientLogRow,
} from "./campaign-failed-recipients"

describe("selectFailedRecipientEmailsForRetry", () => {
  it("inclui apenas e-mails com failed e sem sucesso no provedor", () => {
    const logs: CampaignFailedRecipientLogRow[] = [
      { recipientEmail: "a@test.com", status: "failed" },
      { recipientEmail: "b@test.com", status: "sent" },
      { recipientEmail: "c@test.com", status: "failed" },
      { recipientEmail: "c@test.com", status: "delivered" },
      { recipientEmail: "d@test.com", status: "failed" },
      { recipientEmail: "d@test.com", status: "bounced" },
      { recipientEmail: "e@test.com", status: "suppressed" },
      { recipientEmail: "e@test.com", status: "failed" },
      { recipientEmail: "A@test.com", status: "failed" },
    ]

    expect(selectFailedRecipientEmailsForRetry(logs)).toEqual(["a@test.com"])
  })

  it("normaliza e-mail e ignora queued sem failed", () => {
    const logs: CampaignFailedRecipientLogRow[] = [
      { recipientEmail: "  F@Test.com ", status: "failed" },
      { recipientEmail: "queued@test.com", status: "queued" },
    ]

    expect(selectFailedRecipientEmailsForRetry(logs)).toEqual(["f@test.com"])
  })
})

describe("resolveRetryRecipientEmails", () => {
  it("devolve toda a audiência resolvida quando é retriável e não há log algum", () => {
    // Modo "falhou antes de criar EmailLog" (validação de variáveis abortou o dispatch):
    // ninguém recebeu, então toda a audiência deve ser reenviada.
    const result = resolveRetryRecipientEmails({
      hasAnyLog: false,
      hasRetriableStatus: true,
      logs: [],
      resolvedAudienceEmails: ["  B@Test.com ", "a@test.com", "a@test.com"],
    })

    expect(result).toEqual(["a@test.com", "b@test.com"])
  })

  it("continua devolvendo apenas os failed quando já existem logs (sem regressão)", () => {
    // Modo "Agro - sul": lote falhou dentro do provedor, logs já existem.
    const logs: CampaignFailedRecipientLogRow[] = [
      { recipientEmail: "a@test.com", status: "failed" },
      { recipientEmail: "b@test.com", status: "sent" },
    ]

    const result = resolveRetryRecipientEmails({
      hasAnyLog: true,
      hasRetriableStatus: true,
      logs,
      resolvedAudienceEmails: ["a@test.com", "b@test.com", "c@test.com"],
    })

    expect(result).toEqual(["a@test.com"])
  })

  it("não devolve a audiência inteira quando o status não é retriável", () => {
    const result = resolveRetryRecipientEmails({
      hasAnyLog: false,
      hasRetriableStatus: false,
      logs: [],
      resolvedAudienceEmails: ["a@test.com", "b@test.com"],
    })

    expect(result).toEqual([])
  })
})
