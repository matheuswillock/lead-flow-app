import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  getFormSubmissionScoreBreakdownUseCase,
  type FormSubmissionScoreBreakdown,
} from "@/app/api/useCases/publicForms/GetFormSubmissionScoreBreakdownUseCase"

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
      formSubmissions: FormSubmissionScoreBreakdown[]
    }
  | { notFound: true; formSubmissions: FormSubmissionScoreBreakdown[] }

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

      const [result, formSubmissions] = await Promise.all([
        radarRepository.getLeadRadarEngagementWithCtx(
          { teamId: input.teamId, ctx: input.ctx },
          input.leadId
        ),
        getFormSubmissionScoreBreakdownUseCase.execute({
          teamId: input.teamId,
          leadId: input.leadId,
        }),
      ])

      if (result.notFound) {
        return new Output(true, [], [], {
          notFound: true,
          formSubmissions,
        } satisfies LeadRadarEngagementResult)
      }

      return new Output(true, [], [], {
        notFound: false,
        profileId: result.profileId,
        score: result.score,
        band: result.band,
        topEvents: result.topEvents,
        formSubmissions,
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
