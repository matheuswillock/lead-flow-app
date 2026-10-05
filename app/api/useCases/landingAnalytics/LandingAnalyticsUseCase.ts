import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { Output } from "@/lib/output"
import { landingAnalyticsEventSchema, sanitizeLandingEvent } from "@/lib/landing-analytics/events"

export class LandingAnalyticsUseCase {
  async record(publicId: string, input: unknown, request: Request) {
    const parsed = landingAnalyticsEventSchema.safeParse(input)
    if (!parsed.success) return new Output(false, [], ["Evento inválido"], null)
    const landing = await landingPageUseCase.getPublic(publicId)
    if (!landing.isValid || !landing.result) return new Output(false, [], ["Landing page indisponível"], null)
    const userAgent = request.headers.get("user-agent")
    const origin = request.headers.get("origin") ?? request.headers.get("referer")
    await radarRepository.logPixelHit({
      teamId: String((landing.result as { teamId: string }).teamId),
      eventType: parsed.data.eventType,
      visitorSession: parsed.data.visitorSessionId,
      origin,
      userAgent,
      metadata: sanitizeLandingEvent({
        landingPageId: parsed.data.landingPageId,
        publicationId: parsed.data.publicationId,
        templateSlug: parsed.data.templateSlug,
        attribution: parsed.data.attribution,
        ...parsed.data.metadata,
      }),
    })
    return new Output(true, [], [], { accepted: true })
  }
}

export const landingAnalyticsUseCase = new LandingAnalyticsUseCase()
