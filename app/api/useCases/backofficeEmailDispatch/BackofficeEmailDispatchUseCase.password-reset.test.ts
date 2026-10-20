import { describe, expect, it, mock } from "bun:test"
import type {
  BackofficeEmailDispatchRecord,
  IBackofficeEmailDispatchRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/IBackofficeEmailDispatchRepository"

const recordEmailLifecycleMock = mock(async () => undefined)

mock.module("@/app/api/services/passwordResetAudit/PasswordResetAuditService", () => ({
  passwordResetAuditService: {
    recordEmailLifecycle: recordEmailLifecycleMock,
  },
}))

function makeRepository(): IBackofficeEmailDispatchRepository {
  return {
    findProfileRecipientEmails: mock(async () => null),
    findProfilesByRecipientEmails: mock(async () => []),
    createQueuedDispatch: mock(async () => "dispatch-1"),
    markSent: mock(async () => undefined),
    markFailed: mock(async () => undefined),
    recordGoogleDispatch: mock(async () => "dispatch-1"),
    findByResendEmailId: mock(
      async () =>
        ({
          id: "dispatch-1",
          profileId: "profile-1",
          recipientEmail: "ana@example.com",
          recipientKind: "account",
          provider: "resend",
          category: "access_reset",
          subject: "Reset",
          status: "sent",
          resendEmailId: "re_123",
          sourceType: "password_reset",
          sourceId: "flow-1",
          errorMessage: null,
          sentAt: new Date(),
          deliveredAt: null,
          openedAt: null,
          clickedAt: null,
          bouncedAt: null,
          complainedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as BackofficeEmailDispatchRecord,
    ),
    applyWebhookEvent: mock(async () => undefined),
  }
}

const repository = makeRepository()
mock.module("@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/BackofficeEmailDispatchRepository", () => ({
  backofficeEmailDispatchRepository: repository,
}))

const { BackofficeEmailDispatchUseCase } = await import("./BackofficeEmailDispatchUseCase")

describe("BackofficeEmailDispatchUseCase — password reset correlation", () => {
  it("appends the provider event without persisting provider metadata", async () => {
    recordEmailLifecycleMock.mockClear()
    const useCase = new BackofficeEmailDispatchUseCase()
    const occurredAt = new Date("2026-10-20T12:00:00.000Z")

    const output = await useCase.applyResendWebhookEvent({
      resendEmailId: "re_123",
      eventType: "opened",
      occurredAt,
      metadata: { url: "https://secret.example/reset?token=never-store" },
    })

    expect(output.isValid).toBe(true)
    expect(recordEmailLifecycleMock).toHaveBeenCalledWith("flow-1", "email_opened", "re_123", occurredAt)
    expect(JSON.stringify(recordEmailLifecycleMock.mock.calls[0])).not.toContain("https://")
  })
})
