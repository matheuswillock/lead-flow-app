import { Output } from "@/lib/output"
import { passwordResetAuditService } from "@/app/api/services/passwordResetAudit/PasswordResetAuditService"
import type {
  IPasswordResetTelemetryUseCase,
  PasswordResetTelemetryInput,
} from "./IPasswordResetTelemetryUseCase"

export class PasswordResetTelemetryUseCase implements IPasswordResetTelemetryUseCase {
  async execute(input: PasswordResetTelemetryInput): Promise<Output> {
    const recorded = await passwordResetAuditService.recordTelemetry({
      flowId: input.flowId,
      event: input.eventType,
      ip: input.ip,
      userAgent: input.userAgent,
    })

    return recorded
      ? new Output(true, ["Telemetria registrada"], [], null)
      : new Output(false, [], ["Fluxo de reset não encontrado"], null)
  }
}

export const passwordResetTelemetryUseCase = new PasswordResetTelemetryUseCase()
