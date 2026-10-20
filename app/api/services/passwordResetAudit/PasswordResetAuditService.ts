import { createHmac } from "node:crypto"
import type {
  CreatePasswordResetFlowInput,
  IPasswordResetAuditRepository,
  PasswordResetFlowStatusValue,
  UpdatePasswordResetFlowInput,
} from "../../infra/data/repositories/passwordResetAudit/IPasswordResetAuditRepository"
import { passwordResetAuditRepository } from "../../infra/data/repositories/passwordResetAudit/PasswordResetAuditRepository"
import type { PasswordResetTelemetryEvent } from "@/lib/auth/password-reset-audit"

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

export type PasswordResetTelemetryResult = "recorded" | "not_found" | "forbidden"

const IMMUTABLE_FLOW_STATUSES = new Set<PasswordResetFlowStatusValue>([
  "completed",
  "expired",
  "invalidated",
])

// Eventos que mudam o desfecho do fluxo só valem com a sessão Supabase do destinatário.
const SESSION_PROOF_EVENTS = new Set<PasswordResetTelemetryEvent>([
  "token_verified",
  "password_updated",
  "password_update_failed",
])

const PRE_VERIFICATION_STATUSES = new Set<PasswordResetFlowStatusValue>([
  "requested",
  "link_generated",
  "email_sent",
])

type TelemetryStatusUpdate = Omit<UpdatePasswordResetFlowInput, "flowId">

function isSameEmail(left: string | null | undefined, right: string): boolean {
  return !!left && left.trim().toLowerCase() === right.trim().toLowerCase()
}

function resolveTelemetryStatusUpdate(
  event: PasswordResetTelemetryEvent,
  currentStatus: PasswordResetFlowStatusValue,
): TelemetryStatusUpdate | null {
  switch (event) {
    case "verification_started":
      return PRE_VERIFICATION_STATUSES.has(currentStatus) ? { status: "verification_pending" } : null
    case "token_verified":
      return { status: "token_verified", tokenVerifiedAt: new Date() }
    case "password_updated":
      return { status: "completed", completedAt: new Date() }
    case "password_update_failed":
      return { status: "failed", failureCode: "password_update_failed" }
    default:
      return null
  }
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
    event: PasswordResetTelemetryEvent
    verifiedEmail?: string | null
    ip?: string | null
    userAgent?: string | null
  }): Promise<PasswordResetTelemetryResult> {
    try {
      const flow = await this.repository.findFlowById(input.flowId)
      if (!flow) return "not_found"

      // Fluxos encerrados são imutáveis: o evento é descartado sem sinalizar o motivo.
      if (IMMUTABLE_FLOW_STATUSES.has(flow.status)) return "recorded"

      if (
        SESSION_PROOF_EVENTS.has(input.event) &&
        !isSameEmail(input.verifiedEmail, flow.recipientEmail)
      ) {
        return "forbidden"
      }

      const statusUpdate = resolveTelemetryStatusUpdate(input.event, flow.status)
      if (statusUpdate) {
        await this.repository.updateFlow({ flowId: input.flowId, ...statusUpdate })
      }
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
        ipHash: getIpHash(input.ip),
        userAgent: optionalContext(input.userAgent),
      })
      return "recorded"
    } catch (error) {
      console.error("[PasswordResetAuditService] Falha ao registrar telemetria de reset", error)
      return "not_found"
    }
  }

  async recordEmailLifecycle(
    flowId: string,
    event: "email_delivered" | "email_opened" | "email_clicked",
    resendEmailId: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
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
