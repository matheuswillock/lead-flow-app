import { Output } from "@/lib/output"
import { landingAnalyticsRepository } from "@/app/api/infra/data/repositories/landingAnalytics/LandingAnalyticsRepository"

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000

export class LandingAnalyticsQueryUseCase {
  async execute(input: {
    teamId: string
    from: Date
    to: Date
    landingPageId?: string
    campaignId?: string
    templateSlug?: string
    formId?: string
    publicationId?: string
  }) {
    if (input.to <= input.from) return new Output(false, [], ["Período inválido"], null)
    if (input.to.getTime() - input.from.getTime() > MAX_RANGE_MS) {
      return new Output(false, [], ["O período máximo é de 90 dias"], null)
    }
    const summary = await landingAnalyticsRepository.summarize(input)
    return new Output(true, [], [], { period: { from: input.from.toISOString(), to: input.to.toISOString() }, ...summary })
  }
}

export const landingAnalyticsQueryUseCase = new LandingAnalyticsQueryUseCase()
