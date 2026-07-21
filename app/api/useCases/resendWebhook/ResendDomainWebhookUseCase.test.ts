import { describe, expect, it } from "bun:test"
import { ResendDomainWebhookUseCase } from "./ResendDomainWebhookUseCase"
import type { IEmailTeamDomainEventRepository } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"

describe("ResendDomainWebhookUseCase", () => {
  it("processa domain.updated para time vinculado", async () => {
    const calls: string[] = []
    const repository: IEmailTeamDomainEventRepository = {
      listEvents: async () => [],
      recordEventIfMissing: async () => {
        calls.push("record")
      },
      findTeamByResendDomainId: async () => ({
        teamId: "team-1",
        resendDomainName: "mail.example.com",
      }),
      updateDomainTracking: async () => undefined,
      clearDomainSettings: async () => undefined,
      syncFromResendDomain: async () => ({
        status: "verified",
        region: "sa-east-1",
        openTracking: true,
        clickTracking: true,
      }),
    }

    const useCase = new ResendDomainWebhookUseCase(repository)
    const result = await useCase.handle({
      type: "domain.updated",
      data: {
        id: "dom_123",
        created_at: new Date().toISOString(),
        status: "verified",
      },
    })

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ handled: true, target: "team_domain" })
  })
})
