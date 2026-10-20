import { afterEach, describe, expect, it, mock } from "bun:test"
import { PasswordResetAuditService } from "./PasswordResetAuditService"
import type {
  CreatePasswordResetFlowInput,
  IPasswordResetAuditRepository,
  RecordPasswordResetEventInput,
  UpdatePasswordResetFlowInput,
  PasswordResetEventTypeValue,
  PasswordResetFlowStatusValue,
} from "../../infra/data/repositories/passwordResetAudit/IPasswordResetAuditRepository"

const originalSecret = process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET

function makeRepository() {
  const repository: IPasswordResetAuditRepository = {
    createFlow: mock(async (_input: CreatePasswordResetFlowInput) => ({ id: "flow-1" })),
    recordEvent: mock(async (_input: RecordPasswordResetEventInput) => undefined),
    updateFlow: mock(async (_input: UpdatePasswordResetFlowInput) => undefined),
    findFlowById: mock(async () => ({
      id: "flow-1",
      status: "email_sent" as PasswordResetFlowStatusValue,
      recipientEmail: "Ana@Example.com",
    })),
  }

  return repository
}

function withFlowStatus(repository: IPasswordResetAuditRepository, status: PasswordResetFlowStatusValue) {
  repository.findFlowById = mock(async () => ({
    id: "flow-1",
    status,
    recipientEmail: "ana@example.com",
  }))
}

describe("PasswordResetAuditService", () => {
  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET
    } else {
      process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET = originalSecret
    }
  })

  it("creates one flow and hashes the IP only with the configured secret", async () => {
    process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET = "audit-secret"
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    const flow = await service.createFlow({
      profileId: "profile-1",
      recipientEmail: "ana@example.com",
      ip: "203.0.113.10",
      userAgent: "browser",
      originScreen: "forgot-password",
    })

    expect(flow).toEqual({ id: "flow-1" })
    expect(repository.createFlow).toHaveBeenCalledTimes(1)
    const input = (repository.createFlow as ReturnType<typeof mock>).mock
      .calls[0][0] as CreatePasswordResetFlowInput
    expect(input.status).toBe("requested" satisfies PasswordResetFlowStatusValue)
    expect(input.event.type).toBe("requested" satisfies PasswordResetEventTypeValue)
    expect(input.ipHash).toBeTruthy()
    expect(input.ipHash).not.toContain("203.0.113.10")
  })

  it("omits IP context when the keyed-hash secret is not configured", async () => {
    delete process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    await service.createFlow({
      profileId: null,
      recipientEmail: "ana@example.com",
      ip: "203.0.113.10",
    })

    const input = (repository.createFlow as ReturnType<typeof mock>).mock
      .calls[0][0] as CreatePasswordResetFlowInput
    expect(input.ipHash).toBeNull()
    expect(input.event.ipHash).toBeNull()
  })

  it("records email_sent with the dispatch/provider correlation and no URL data", async () => {
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    await service.recordEmailSent("flow-1", {
      dispatchId: "dispatch-1",
      resendEmailId: "re_123",
    })

    expect(repository.updateFlow).toHaveBeenCalledWith({
      flowId: "flow-1",
      status: "email_sent",
      emailSentAt: expect.any(Date),
      dispatchId: "dispatch-1",
      resendEmailId: "re_123",
    })
    expect(repository.recordEvent).toHaveBeenCalledWith({
      flowId: "flow-1",
      type: "email_sent",
      requestId: "re_123",
      failureCode: null,
      ipHash: null,
      userAgent: null,
    })
    expect(
      JSON.stringify((repository.recordEvent as ReturnType<typeof mock>).mock.calls[0][0]),
    ).not.toContain("https://")
  })

  it("records email_failed with a stable failure code", async () => {
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    await service.recordEmailFailed("flow-1", "dispatch-1")

    expect(repository.updateFlow).toHaveBeenCalledWith({
      flowId: "flow-1",
      status: "failed",
      failureCode: "email_send_failed",
    })
    expect(repository.recordEvent).toHaveBeenCalledWith({
      flowId: "flow-1",
      type: "email_failed",
      requestId: "dispatch-1",
      failureCode: "email_send_failed",
      ipHash: null,
      userAgent: null,
    })
  })

  it("maps authenticated telemetry to the flow status without accepting secrets", async () => {
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    const recorded = await service.recordTelemetry({
      flowId: "flow-1",
      event: "password_updated",
      verifiedEmail: "ana@example.com",
      userAgent: "browser",
    })

    expect(recorded).toBe("recorded")
    expect(repository.findFlowById).toHaveBeenCalledWith("flow-1")
    expect(repository.updateFlow).toHaveBeenCalledWith({
      flowId: "flow-1",
      status: "completed",
      completedAt: expect.any(Date),
    })
    expect(repository.recordEvent).toHaveBeenCalledWith({
      flowId: "flow-1",
      type: "password_updated",
      requestId: null,
      failureCode: null,
      ipHash: null,
      userAgent: "browser",
    })
  })

  it("rejects outcome events without the recipient's session proof", async () => {
    for (const verifiedEmail of [undefined, null, "other@example.com"]) {
      const repository = makeRepository()
      const service = new PasswordResetAuditService(repository)

      const result = await service.recordTelemetry({ flowId: "flow-1", event: "password_updated", verifiedEmail })

      expect(result).toBe("forbidden")
      expect(repository.updateFlow).not.toHaveBeenCalled()
      expect(repository.recordEvent).not.toHaveBeenCalled()
    }
  })

  it("keeps closed flows immutable even with a valid session proof", async () => {
    for (const status of ["completed", "expired", "invalidated"] as const) {
      const repository = makeRepository()
      withFlowStatus(repository, status)
      const service = new PasswordResetAuditService(repository)

      const result = await service.recordTelemetry({
        flowId: "flow-1",
        event: "password_update_failed",
        verifiedEmail: "ana@example.com",
      })

      expect(result).toBe("recorded")
      expect(repository.updateFlow).not.toHaveBeenCalled()
      expect(repository.recordEvent).not.toHaveBeenCalled()
    }
  })

  it("logs anonymous client events without changing the outcome status", async () => {
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)

    await service.recordTelemetry({ flowId: "flow-1", event: "page_opened" })
    await service.recordTelemetry({ flowId: "flow-1", event: "token_rejected" })

    expect(repository.updateFlow).not.toHaveBeenCalled()
    expect(repository.recordEvent).toHaveBeenCalledTimes(2)
  })

  it("moves to verification_pending only before verification", async () => {
    const early = makeRepository()
    await new PasswordResetAuditService(early).recordTelemetry({ flowId: "flow-1", event: "verification_started" })
    expect(early.updateFlow).toHaveBeenCalledWith({ flowId: "flow-1", status: "verification_pending" })

    const late = makeRepository()
    withFlowStatus(late, "token_verified")
    await new PasswordResetAuditService(late).recordTelemetry({ flowId: "flow-1", event: "verification_started" })
    expect(late.updateFlow).not.toHaveBeenCalled()
  })

  it("appends provider delivery events using only the resend correlation", async () => {
    const repository = makeRepository()
    const service = new PasswordResetAuditService(repository)
    const occurredAt = new Date("2026-10-20T12:00:00.000Z")

    await service.recordEmailLifecycle("flow-1", "email_opened", "re_123", occurredAt)

    expect(repository.recordEvent).toHaveBeenCalledWith({
      flowId: "flow-1",
      type: "email_opened",
      requestId: "re_123",
      occurredAt,
      failureCode: null,
      ipHash: null,
      userAgent: null,
    })
  })
})
