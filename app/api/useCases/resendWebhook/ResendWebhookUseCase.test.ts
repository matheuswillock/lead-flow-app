import { describe, expect, it } from "bun:test"
import { ResendWebhookUseCase } from "./ResendWebhookUseCase"
import type { ResendWebhookService } from "@/app/api/services/resend/ResendWebhookService"
import type { ResendEmailEnrichmentService } from "@/app/api/services/resend/ResendEmailEnrichmentService"
import { ResendDomainWebhookUseCase } from "./ResendDomainWebhookUseCase"
import { Output } from "@/lib/output"

describe("ResendWebhookUseCase", () => {
  it("delega eventos domain.* para ResendDomainWebhookUseCase", async () => {
    const originalHandle = ResendDomainWebhookUseCase.prototype.handle
    ResendDomainWebhookUseCase.prototype.handle = async () =>
      new Output(true, [], [], { handled: true, target: "team_domain" })

    try {
      const useCase = new ResendWebhookUseCase(
        {
          mapEventType: () => null,
        } as unknown as ResendWebhookService,
        {} as ResendEmailEnrichmentService
      )

      const result = await useCase.handle({
        event: {
          type: "domain.updated",
          data: {
            id: "dom_123",
            created_at: new Date().toISOString(),
            status: "verified",
          },
        },
      })

      expect(result.isValid).toBe(true)
      expect(result.result).toMatchObject({ handled: true, target: "team_domain" })
    } finally {
      ResendDomainWebhookUseCase.prototype.handle = originalHandle
    }
  })
})
