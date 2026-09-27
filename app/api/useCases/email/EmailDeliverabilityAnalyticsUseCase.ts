import { Output } from "@/lib/output"
import { emailDeliverabilityAnalyticsService } from "@/app/api/services/emailDeliverability/EmailDeliverabilityAnalyticsService"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

export class EmailDeliverabilityAnalyticsUseCase {
  async get(ctx: TeamAccess): Promise<Output> {
    try { return new Output(true, [], [], { breakdown: await emailDeliverabilityAnalyticsService.getBreakdown(ctx.teamId) }) }
    catch { return new Output(false, [], ["Não foi possível carregar a análise de deliverability"], null) }
  }
}
