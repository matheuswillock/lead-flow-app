import { afterEach, describe, expect, it, mock } from "bun:test"
import type { PasswordResetEventType, PasswordResetFlowStatus } from "@prisma/client"
import { PasswordResetAuditService } from "./PasswordResetAuditService"
import type {
  CreatePasswordResetFlowInput,
  IPasswordResetAuditRepository,
  RecordPasswordResetEventInput,
  UpdatePasswordResetFlowInput,
} from "../../infra/data/repositories/passwordResetAudit/IPasswordResetAuditRepository"

const originalSecret = process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET

function makeRepository() {
  const repository: IPasswordResetAuditRepository = {
    createFlow: mock(async (_input: CreatePasswordResetFlowInput) => ({ id: "flow-1" })),
    recordEvent: mock(async (_input: RecordPasswordResetEventInput) => undefined),
    updateFlow: mock(async (_input: UpdatePasswordResetFlowInput) => undefined),
    findFlowForSupabaseUser: mock(async () => ({ id: "flow-1", status: "email_sent" })),
  }

  return repository
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
    const input = (repository.createFlow as ReturnType<typeof mock>).mock.calls[0][0] as CreatePasswordResetFlowInput
    expect(input.status).toBe("requested" satisfies PasswordResetFlowStatus)
    expect(input.event.type).toBe("requested" satisfies PasswordResetEventType)
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

    const input = (repository.createFlow as ReturnType<typeof mock>).mock.calls[0][0] as CreatePasswordResetFlowInput
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
      JSON.stringify((repository.recordEvent as ReturnType<typeof mock>).mock.calls[0][0])
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
      supabaseId: "supabase-1",
      event: "password_updated",
      userAgent: "browser",
    })

    expect(recorded).toBe(true)
    expect(repository.findFlowForSupabaseUser).toHaveBeenCalledWith("flow-1", "supabase-1")
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
})
    
