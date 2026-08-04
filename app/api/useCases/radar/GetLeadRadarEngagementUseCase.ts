import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

export type LeadRadarEngagementResult =
  | {
      notFound: false
      profileId: string
      score: number
      band: string
      topEvents: Array<{
        eventType: string
        occurredAt: string
        contribution: number
      }>
    }
  | { notFound: true }

class GetLeadRadarEngagementUseCase {
  async execute(input: {
    teamId: string
    ctx: TeamContext
    leadId: string
  }): Promise<Output> {
    try {
      if (!input.leadId.trim()) {
        return new Output(false, [], ["leadId é obrigatório"], null)
      }

      const result = await radarRepository.getLeadRadarEngagementWithCtx(
        { teamId: input.teamId, ctx: input.ctx },
        input.leadId
      )

      if (result.notFound) {
        return new Output(true, [], [], { notFound: true } satisfies LeadRadarEngagementResult)
      }

      return new Output(true, [], [], {
        notFound: false,
        profileId: result.profileId,
        score: result.score,
        band: result.band,
        topEvents: result.topEvents,
      } satisfies LeadRadarEngagementResult)
    } catch (error) {
      console.error("[GetLeadRadarEngagementUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao buscar engajamento Radar do lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const getLeadRadarEngagementUseCase = new GetLeadRadarEngagementUseCase()
