import { describe, expect, it, mock } from "bun:test"

const createIdempotentLeadActivity = mock(async () => ({ id: "activity-1" }))
const resolveLeadIdFromRecipientEmail = mock(async (): Promise<string | null> => "lead-1")

mock.module("@/lib/lead-activities/createIdempotentLeadActivity", () => ({
  createIdempotentLeadActivity,
}))

mock.module("@/lib/lead-activities/resolveLeadIdFromRecipientEmail", () => ({
  resolveLeadIdFromRecipientEmail,
}))

const { EmailCampaignLeadActivityService } = await import("./EmailCampaignLeadActivityService")

describe("EmailCampaignLeadActivityService", () => {
  it("não cria atividade quando não há lead vinculado ao contato", async () => {
    resolveLeadIdFromRecipientEmail.mockResolvedValueOnce(null)
    createIdempotentLeadActivity.mockClear()

    const service = new EmailCampaignLeadActivityService()
    await service.recordDispatchForRecipient({
      teamId: "team-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "sem-lead@test.com",
      subject: "Assunto",
    })

    expect(createIdempotentLeadActivity).not.toHaveBeenCalled()
  })

  it("cria atividade idempotente por dispatchId", async () => {
    resolveLeadIdFromRecipientEmail.mockResolvedValueOnce("lead-1")
    createIdempotentLeadActivity.mockClear()

    const service = new EmailCampaignLeadActivityService()
    await service.recordDispatchForRecipient({
      teamId: "team-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "lead@test.com",
      subject: "Campanha de teste",
    })

    expect(createIdempotentLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        type: "email",
        body: "E-mail enviado: Campanha de teste",
        sourceKey: "email:dispatch:dispatch-1",
        createdBy: null,
        payload: {
          campaignId: "campaign-1",
          subject: "Campanha de teste",
          dispatchId: "dispatch-1",
        },
      })
    )
  })
})
