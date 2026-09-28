import { Output } from "@/lib/output"
import { emailDeliverabilityAnalyticsService } from "@/app/api/services/emailDeliverability/EmailDeliverabilityAnalyticsService"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

export class EmailDeliverabilityAnalyticsUseCase {
  async get(
    ctx: TeamAccess,
    input: { days: number; senderDomain?: string; recipientProvider?: string; campaignId?: string }
  ): Promise<Output> {
    try {
      const to = new Date()
      const from = new Date(to.getTime() - input.days * 86_400_000)
      const dashboard = await emailDeliverabilityAnalyticsService.getDashboard(ctx.teamId, {
        from,
        to,
        senderDomain: input.senderDomain,
        recipientProvider: input.recipientProvider,
        campaignId: input.campaignId,
      })
      return new Output(true, [], [], dashboard)
    } catch (error) {
      console.error("[EmailDeliverabilityAnalyticsUseCase][get]", error)
      return new Output(false, [], ["Não foi possível carregar a análise de deliverability"], null)
    }
  }
}
