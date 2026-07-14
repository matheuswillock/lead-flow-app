import { Output } from "@/lib/output"
import { termsAcceptanceOutboxService } from "@/app/api/services/BackofficeTermsAcceptance/TermsAcceptanceOutboxService"
import type { IBackofficeTermsAcceptanceOutboxUseCase } from "./IBackofficeTermsAcceptanceOutboxUseCase"

export class BackofficeTermsAcceptanceOutboxUseCase implements IBackofficeTermsAcceptanceOutboxUseCase {
  async dispatchPending(limit = 25): Promise<Output> {
    try {
      const result = await termsAcceptanceOutboxService.dispatchPending(limit)
      return new Output(result.failed === 0, result.failed === 0 ? ["Outbox processado"] : [], result.failed ? [`${result.failed} tarefa(s) falharam`] : [], result)
    } catch (error) {
      console.error("[BackofficeTermsAcceptanceOutboxUseCase]", error)
      return new Output(false, [], ["Erro ao processar o outbox de aceite"], null)
    }
  }
}

export const backofficeTermsAcceptanceOutboxUseCase = new BackofficeTermsAcceptanceOutboxUseCase()
