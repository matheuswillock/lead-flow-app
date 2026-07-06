import { describe, expect, it } from "bun:test"
import {
  EMAIL_CAMPAIGN_FAILURE_MESSAGES,
  EmailCampaignUseCase,
} from "./EmailCampaignUseCase"
import { resolveCampaignStatusAfterDispatch } from "@/lib/email/campaign-dispatch-guards"

describe("EmailCampaignUseCase", () => {
  const useCase = new EmailCampaignUseCase()

  it("expõe dispatchScheduledCampaigns e recoverStuckSendingCampaigns", () => {
    expect(typeof useCase.dispatchScheduledCampaigns).toBe("function")
    expect(typeof useCase.recoverStuckSendingCampaigns).toBe("function")
  })

  it("define mensagens de falha específicas para créditos e destinatários", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS).toContain("créditos")
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST).toContain("contato")
  })
})

describe("resolveCampaignStatusAfterDispatch (contrato do disparo)", () => {
  it("não marca sent quando nenhum e-mail foi enviado", () => {
    const result = resolveCampaignStatusAfterDispatch(0)
    expect(result.campaignStatus).toBe("failed")
    expect(result.dispatchStatus).toBe("failed")
    expect(result.errorMessage).toBeTruthy()
  })
})
