import { Output } from "@/lib/output"
import { backofficeEmailDeliverabilityService } from "@/app/api/services/backofficeEmailDeliverability/BackofficeEmailDeliverabilityService"

export class BackofficeEmailDeliverabilityUseCase {
  async list(input: { days: number; teamId?: string; senderDomain?: string; recipientProvider?: string }): Promise<Output> {
    try {
      return new Output(true, [], [], await backofficeEmailDeliverabilityService.getDashboard({
        from: new Date(Date.now() - input.days * 86_400_000),
        teamId: input.teamId,
        senderDomain: input.senderDomain,
        recipientProvider: input.recipientProvider,
      }))
    } catch (error) {
      console.error("[BackofficeEmailDeliverabilityUseCase][list]", error)
      return new Output(false, [], ["Não foi possível carregar a reputação dos times"], null)
    }
  }
}

export const backofficeEmailDeliverabilityUseCase = new BackofficeEmailDeliverabilityUseCase()
