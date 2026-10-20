import type { PasswordResetTelemetryEvent } from "@/lib/auth/password-reset-audit"
import { Output } from "@/lib/output"

export interface PasswordResetTelemetryInput {
  flowId: string
  eventType: PasswordResetTelemetryEvent
  accessToken?: string | null
  ip?: string | null
  userAgent?: string | null
}

export interface IPasswordResetTelemetryUseCase {
  execute(input: PasswordResetTelemetryInput): Promise<Output>
}
