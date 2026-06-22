import type { BackofficeEmailDispatchEventType } from "@prisma/client"
import { Output } from "@/lib/output"
import { backofficeEmailDispatchRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/BackofficeEmailDispatchRepository"
import { BackofficeEmailDispatchService } from "@/app/api/services/backofficeEmailDispatch/BackofficeEmailDispatchService"

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

    return new Output(true, ["Evento de dispatch processado"], [], { handled: true })
  }
}

export const backofficeEmailDispatchUseCase = new BackofficeEmailDispatchUseCase()
