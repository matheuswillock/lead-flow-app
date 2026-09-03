import { describe, expect, it } from "bun:test"
import {
  findLooseEmailInAnswers,
  isLooseEmailDivergentFromRecipient,
  isSubmissionConvergentWithCampaignRecipient,
} from "./campaign-recipient-identity"

// Caso real ML SERVICOS/KKJ (02/09): submissão de campanha só com telefone,
// nenhum e-mail digitado em lugar nenhum — nada para contradizer o destinatário.
const recipient = { recipientEmail: "marianalombardi@uol.com.br", recipientName: "Mariana Lombardi" }

describe("isSubmissionConvergentWithCampaignRecipient", () => {
  it("converge quando não há e-mail digitado em lugar nenhum (caso ML SERVICOS)", () => {
    expect(
      isSubmissionConvergentWithCampaignRecipient(
        { name: "ML Servicos de Arquitetura", phone: "11964326587", email: null },
        recipient,
      ),
    ).toBe(true)
  })

  it("diverge quando telefone e e-mail digitados juntos contradizem o destinatário (encaminhamento)", () => {
    expect(
      isSubmissionConvergentWithCampaignRecipient(
        { name: "Outra Pessoa", phone: "11999998888", email: "outrapessoa@example.com" },
        recipient,
      ),
    ).toBe(false)
  })

  it("converge quando o e-mail digitado bate com o do destinatário", () => {
    expect(
      isSubmissionConvergentWithCampaignRecipient(
        { name: "Mariana", phone: "11964326587", email: "MarianaLombardi@uol.com.br" },
        recipient,
      ),
    ).toBe(true)
  })
})

describe("findLooseEmailInAnswers", () => {
  it("acha e-mail digitado como texto solto numa resposta sem mapping (caso KKJ)", () => {
    expect(
      findLooseEmailInAnswers([
        { value: "leonardo@reinventengenharia.com.br" },
        { value: "outra resposta qualquer" },
      ]),
    ).toBe("leonardo@reinventengenharia.com.br")
  })

  it("devolve null quando nenhuma resposta parece e-mail", () => {
    expect(findLooseEmailInAnswers([{ value: "11964326587" }, { value: "Sim" }])).toBeNull()
  })

  it("ignora valores não-string", () => {
    expect(findLooseEmailInAnswers([{ value: 42 }, { value: null }])).toBeNull()
  })
})

describe("isLooseEmailDivergentFromRecipient", () => {
  it("diverge quando o e-mail solto é diferente do destinatário (caso KKJ invertido — encaminhamento)", () => {
    expect(
      isLooseEmailDivergentFromRecipient("outrapessoa@example.com", recipient),
    ).toBe(true)
  })

  it("converge (não diverge) quando o e-mail solto bate com o destinatário", () => {
    expect(
      isLooseEmailDivergentFromRecipient("MarianaLombardi@uol.com.br", recipient),
    ).toBe(false)
  })

  it("sem e-mail solto (null) → nunca diverge, nada para contradizer", () => {
    expect(isLooseEmailDivergentFromRecipient(null, recipient)).toBe(false)
  })
})
