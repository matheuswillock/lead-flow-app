import type { PublicFormMetricType, Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { parseRecipientEmailFromOrigin } from "@/lib/public-forms/email-campaign-attribution"
import { normalizeRadarEmail } from "@/lib/radar/normalization"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import {
  mapPublicFormMetricToRadarEventType,
  PUBLIC_FORM_RADAR_SOURCE_TYPE,
} from "@/lib/radar/map-public-form-metric-to-radar-event"

export type SyncPublicFormMetricToRadarInput = {
  teamId: string
  eventType: PublicFormMetricType | string
  eventKey: string
  visitorSessionId: string
  formId: string
  publicationId: string
  questionId?: string | null
  leadId?: string | null
  origin?: unknown
  occurredAt?: Date
}

class SyncPublicFormMetricToRadarUseCase {
  async execute(input: SyncPublicFormMetricToRadarInput): Promise<Output> {
    try {
      const hasFeature = await teamHasRadarFeature(input.teamId)
      if (!hasFeature) {
        return new Output(true, [], [], { skipped: "feature_disabled" })
      }

      const radarEventType = mapPublicFormMetricToRadarEventType(input.eventType)
      if (!radarEventType) {
        return new Output(true, [], [], { skipped: "unknown_event_type" })
      }

      const profileId = await this.resolveProfileId(input)
      if (!profileId) {
        return new Output(false, [], ["Perfil Radar não resolvido"], null)
      }

      const occurredAt = input.occurredAt ?? new Date()
      const metadata: Prisma.InputJsonValue = {
        formId: input.formId,
        publicationId: input.publicationId,
        ...(input.questionId ? { questionId: input.questionId } : {}),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.origin && typeof input.origin === "object" && input.origin !== null
          ? { origin: input.origin as Prisma.InputJsonValue }
          : {}),
      }

      const event = await radarRepository.appendEventIfNewBySourceKey({
        profileId,
        teamId: input.teamId,
        eventType: radarEventType,
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: input.eventKey,
        occurredAt,
        metadata,
      })

      return new Output(true, [], [], {
        profileId,
        eventType: radarEventType,
        created: Boolean(event),
      })
    } catch (error) {
      console.error("[SyncPublicFormMetricToRadarUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao espelhar métrica de formulário no Radar"
      return new Output(false, [], [message], null)
    }
  }

  private async resolveProfileId(input: SyncPublicFormMetricToRadarInput): Promise<string | null> {
    const leadId = input.leadId?.trim() || null
    // Com atribuição e-mail→form, qualquer métrica com leadId conhecido usa o mesmo perfil Radar.
    if (leadId) {
      let identity = await radarRepository.findProfileByIdentity(input.teamId, "lead_id", leadId)
      if (!identity) {
        await syncLeadToRadarUseCase.execute({ leadId, teamId: input.teamId })
        identity = await radarRepository.findProfileByIdentity(input.teamId, "lead_id", leadId)
      }
      if (identity) return identity.profileId
    }

    // E1: form_viewed/started sem Lead — resolve pelo destinatário do EmailLog
    // (mesmo caminho de syncFromEmail / handleEmailWebhookEvent desde D4).
    const recipientEmail = parseRecipientEmailFromOrigin(
      input.origin && typeof input.origin === "object" && input.origin !== null
        ? (input.origin as Record<string, unknown>)
        : null
    )
    if (recipientEmail) {
      const normalizedEmail = normalizeRadarEmail(recipientEmail)
      if (normalizedEmail) {
        const { profile } = await radarRepository.resolveProfileForEmail({
          teamId: input.teamId,
          normalizedEmail,
          emailValue: recipientEmail,
          displayName: null,
          normalizedName: null,
          emailSource: "email_log",
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        return profile.id
      }
    }

    const { profile } = await radarRepository.resolveProfileForVisitorSession({
      teamId: input.teamId,
      visitorSession: input.visitorSessionId,
      lastSeenAt: input.occurredAt ?? new Date(),
    })
    return profile.id
  }
}

export const syncPublicFormMetricToRadarUseCase = new SyncPublicFormMetricToRadarUseCase()
