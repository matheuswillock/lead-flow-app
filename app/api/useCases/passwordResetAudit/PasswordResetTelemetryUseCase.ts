import { Output } from "@/lib/output"
import { verifySessionEmail } from "@/lib/auth/verify-session-email"
import { passwordResetAuditService } from "@/app/api/services/passwordResetAudit/PasswordResetAuditService"
import type {
  IPasswordResetTelemetryUseCase,
  PasswordResetTelemetryInput,
} from "./IPasswordResetTelemetryUseCase"

export class PasswordResetTelemetryUseCase implements IPasswordResetTelemetryUseCase {
  async execute(input: PasswordResetTelemetryInput): Promise<Output> {
    const outcome = await passwordResetAuditService.recordTelemetry({
      flowId: input.flowId,
      event: input.eventType,
      verifiedEmail: await verifySessionEmail(input.accessToken),
      ip: input.ip,
      userAgent: input.userAgent,
    })

    if (outcome === "recorded") return new Output(true, ["Telemetria registrada"], [], { outcome })
    if (outcome === "forbidden") {
      return new Output(false, [], ["Sessão do destinatário necessária para este evento"], { outcome })
    }
    return new Output(false, [], ["Fluxo de reset não encontrado"], { outcome })
  }
}

export const passwordResetTelemetryUseCase = new PasswordResetTelemetryUseCase()
