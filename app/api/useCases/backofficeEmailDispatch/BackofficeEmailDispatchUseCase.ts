import type { BackofficeEmailDispatchEventType } from "@prisma/client"
import { Output } from "@/lib/output"
import { backofficeEmailDispatchRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/BackofficeEmailDispatchRepository"
import { BackofficeEmailDispatchService } from "@/app/api/services/backofficeEmailDispatch/BackofficeEmailDispatchService"
import { passwordResetAuditService } from "@/app/api/services/passwordResetAudit/PasswordResetAuditService"

const PASSWORD_RESET_EVENT_MAP: Partial<
  Record<BackofficeEmailDispatchEventType, "email_delivered" | "email_opened" | "email_clicked">
> = {
  delivered: "email_delivered",
  opened: "email_opened",
  clicked: "email_clicked",
}

export class BackofficeEmailDispatchUseCase {
  constructor(
    private readonly dispatchService = new BackofficeEmailDispatchService(backofficeEmailDispatchRepository)
  ) {}

  async applyResendWebhookEvent(input: {
    resendEmailId: string
    eventType: BackofficeEmailDispatchEventType
    occurredAt: Date
    metadata?: Record<string, unknown>
  }): Promise<Output> {
    const handled = await this.dispatchService.applyResendWebhookEvent({
      resendEmailId: input.resendEmailId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      metadata: input.metadata,
    })

    if (!handled) {
      return new Output(false, [], ["Dispatch não encontrado"], { handled: false })
    }

    const dispatch = await backofficeEmailDispatchRepository.findByResendEmailId(input.resendEmailId)
    const passwordResetEvent = PASSWORD_RESET_EVENT_MAP[input.eventType]
    if (dispatch?.sourceType === "password_reset" && dispatch.sourceId && passwordResetEvent) {
      await passwordResetAuditService.recordEmailLifecycle(
        dispatch.sourceId,
        passwordResetEvent,
        input.resendEmailId,
        input.occurredAt,
      )
    }

    return new Output(true, ["Evento de dispatch processado"], [], { handled: true })
  }
}

export const backofficeEmailDispatchUseCase = new BackofficeEmailDispatchUseCase()
