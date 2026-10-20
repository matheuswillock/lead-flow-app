import { createHmac } from "node:crypto"
import type {
  CreatePasswordResetFlowInput,
  IPasswordResetAuditRepository,
} from "../../infra/data/repositories/passwordResetAudit/IPasswordResetAuditRepository"
import { passwordResetAuditRepository } from "../../infra/data/repositories/passwordResetAudit/PasswordResetAuditRepository"

export interface CreatePasswordResetAuditFlowInput {
  profileId?: string | null
  recipientEmail: string
  ip?: string | null
  userAgent?: string | null
  originScreen?: string | null
}

export interface PasswordResetEmailCorrelation {
  dispatchId?: string | null
  resendEmailId?: string | null
}

export type PasswordResetTelemetryEvent =
  | "page_opened"
  | "verification_started"
  | "token_verified"
  | "token_rejected"
  | "password_updated"
  | "password_update_failed"
  | "expired"

function getIpHash(ip: string | null | undefined): string | null {
  const secret = process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET?.trim()
  const normalizedIp = ip?.trim()

  if (!secret || !normalizedIp || normalizedIp === "unknown") {
    return null
  }

  return createHmac("sha256", secret).update(normalizedIp).digest("hex")
}

function optionalContext(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized !== "unknown" ? normalized : null
}

export class PasswordResetAuditService {
  constructor(private readonly repository: IPasswordResetAuditRepository) {}

  async createFlow(input: CreatePasswordResetAuditFlowInput): Promise<{ id: string } | null> {
    const ipHash = getIpHash(input.ip)
    const userAgent = optionalContext(input.userAgent)
    const originScreen = optionalContext(input.originScreen)
    const repositoryInput: CreatePasswordResetFlowInput = {
      profileId: input.profileId ?? null,
      recipientEmail: input.recipientEmail,
      status: "requested",
      ipHash,
      userAgent,
      originScreen,
      event: {
        type: "requested",
        ipHash,
        userAgent,
      },
    }

    try {
      return await this.repository.createFlow(repositoryInput)
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao criar auditoria de reset", error)
      return null
    }
  }

  async recordLinkGenerated(flowId: string): Promise<void> {
    await this.recordEventAndStatus(flowId, {
      type: "link_generated",
      status: "link_generated",
      linkGeneratedAt: new Date(),
    })
  }

  async recordEmailSent(flowId: string, correlation: PasswordResetEmailCorrelation): Promise<void> {
    await this.recordEventAndStatus(flowId, {
      type: "email_sent",
      status: "email_sent",
      emailSentAt: new Date(),
      requestId: correlation.resendEmailId ?? correlation.dispatchId ?? null,
      dispatchId: correlation.dispatchId,
      resendEmailId: correlation.resendEmailId,
    })
  }

  async recordEmailFailed(flowId: string, correlationId?: string | null): Promise<void> {
    await this.recordEventAndStatus(flowId, {
      type: "email_failed",
      status: "failed",
      failureCode: "email_send_failed",
      requestId: correlationId ?? null,
    })
  }

  async recordFailure(flowId: string, failureCode: string): Promise<void> {
    try {
      await this.repository.updateFlow({ flowId, status: "failed", failureCode })
      await this.repository.recordEvent({
        flowId,
        type: "failed",
        failureCode,
        requestId: null,
        ipHash: null,
        userAgent: null,
      })
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao registrar falha de reset", error)
    }
  }

  async recordTelemetry(input: {
    flowId: string
    supabaseId?: string | null
    event: PasswordResetTelemetryEvent
    userAgent?: string | null
  }): Promise<boolean> {
    try {
      const flow = input.supabaseId
        ? await this.repository.findFlowForSupabaseUser(input.flowId, input.supabaseId)
        : await this.repository.findFlowById(input.flowId)
      if (!flow) return false

      const update = {
        flowId: input.flowId,
        ...(input.event === "token_verified"
          ? { status: "token_verified" as const, tokenVerifiedAt: new Date() }
          : input.event === "verification_started"
            ? { status: "verification_pending" as const }
            : input.event === "password_updated"
              ? { status: "completed" as const, completedAt: new Date() }
              : input.event === "token_rejected"
                ? { status: "failed" as const, failureCode: "token_rejected" }
                : input.event === "password_update_failed"
                  ? { status: "failed" as const, failureCode: "password_update_failed" }
                  : input.event === "expired"
                    ? { status: "expired" as const }
                    : { status: flow.status }),
      }
      await this.repository.updateFlow(update)
      await this.repository.recordEvent({
        flowId: input.flowId,
        type: input.event,
        failureCode:
          input.event === "token_rejected"
            ? "token_rejected"
            : input.event === "password_update_failed"
              ? "password_update_failed"
              : null,
        requestId: null,
        ipHash: null,
        userAgent: optionalContext(input.userAgent),
      })
      return true
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao registrar telemetria de reset", error)
      return false
    }
  }

  async recordEmailLifecycle(
    flowId: string,
    event: "email_delivered" | "email_opened" | "email_clicked",
    resendEmailId: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
      await this.repository.updateFlow({ flowId, status: "email_sent" })
      await this.repository.recordEvent({
        flowId,
        type: event,
        requestId: resendEmailId,
        occurredAt,
        failureCode: null,
        ipHash: null,
        userAgent: null,
      })
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao registrar evento de entrega", error)
    }
  }

  private async recordEventAndStatus(
    flowId: string,
    input: {
      type: "link_generated" | "email_sent" | "email_failed"
      status: "link_generated" | "email_sent" | "failed"
      requestId?: string | null
      failureCode?: string
      linkGeneratedAt?: Date
      emailSentAt?: Date
      dispatchId?: string | null
      resendEmailId?: string | null
    },
  ): Promise<void> {
    try {
      const update: Parameters<IPasswordResetAuditRepository["updateFlow"]>[0] = {
        flowId,
        status: input.status,
      }
      if (input.linkGeneratedAt) update.linkGeneratedAt = input.linkGeneratedAt
      if (input.emailSentAt) update.emailSentAt = input.emailSentAt
      if (input.failureCode) update.failureCode = input.failureCode
      if (input.dispatchId !== undefined) update.dispatchId = input.dispatchId
      if (input.resendEmailId !== undefined) update.resendEmailId = input.resendEmailId

      await this.repository.updateFlow(update)
      await this.repository.recordEvent({
        flowId,
        type: input.type,
        requestId: input.requestId ?? null,
        failureCode: input.failureCode ?? null,
        ipHash: null,
        userAgent: null,
      })
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao registrar evento de reset", error)
    }
  }
}

export const passwordResetAuditService = new PasswordResetAuditService(passwordResetAuditRepository)
