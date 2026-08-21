import type { PublicFormMetricType, Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"
import { normalizeRadarName, normalizeRadarPhone } from "@/lib/radar/normalization"
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
  /**
   * `mappingKey`/valor da resposta (D2). Campo dedicado, nunca extraído de
   * `origin` — `origin` é um bag livre que passa por `sanitizePublicFormOrigin`
   * (allowlist sem esses campos) e, no caminho `/events`, chega direto do
   * corpo JSON do cliente sem allowlist nenhuma. Confiar nesses valores só
   * quando vêm por aqui, preenchidos server-side a partir do snapshot em
   * `PublicFormProgressUseCase`.
   */
  answerMappingKey?: string | null
  answerValue?: string | null
  occurredAt?: Date
}

class SyncPublicFormMetricToRadarUseCase {
  async execute(input: SyncPublicFormMetricToRadarInput): Promise<Output> {
    try {
      const radarEventType = mapPublicFormMetricToRadarEventType(input.eventType)
      if (!radarEventType) {
        return new Output(true, [], [], { skipped: "unknown_event_type" })
      }

      const hasFeature = await teamHasRadarFeature(input.teamId)
      let profileId: string | null = null
      let eventCreated = false

      if (hasFeature) {
        profileId = await this.resolveProfileId(input)
        if (!profileId) {
          return new Output(false, [], ["Perfil Radar não resolvido"], null)
        }

        if (input.answerMappingKey === "name" && input.answerValue?.trim()) {
          await radarRepository.applyFormAnswerDisplayName(
            profileId,
            input.teamId,
            input.answerValue.trim(),
          )
        }

        const occurredAt = input.occurredAt ?? new Date()
        const campaignId = this.extractCampaignId(input.origin)
        const metadata: Prisma.InputJsonValue = {
          formId: input.formId,
          publicationId: input.publicationId,
          ...(campaignId ? { campaignId } : {}),
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
        eventCreated = Boolean(event)

        console.info("[SyncPublicFormMetricToRadarUseCase][execute] evento sincronizado com o Radar", {
          eventKey: input.eventKey,
          visitorSessionId: input.visitorSessionId,
          questionId: input.questionId ?? null,
          leadId: input.leadId ?? null,
          profileId,
          eventType: radarEventType,
          eventCreated,
        })
      }

      let leadId = input.leadId ?? null
      if (input.eventType === "question_answered") {
        const { createCrmLeadFromRadarFormGateUseCase } = await import(
          "@/app/api/useCases/radar/CreateCrmLeadFromRadarFormGateUseCase"
        )
        const gate = await createCrmLeadFromRadarFormGateUseCase.execute({
          teamId: input.teamId,
          formId: input.formId,
          publicationId: input.publicationId,
          visitorSessionId: input.visitorSessionId,
          origin: input.origin,
          profileId,
          questionId: input.questionId,
          answerValue: input.answerValue,
        })
        if (!gate.isValid) {
          return gate
        }
        const gateLeadId =
          gate.result && typeof gate.result === "object" && "leadId" in gate.result
            ? (gate.result as { leadId?: string | null }).leadId
            : null
        if (gateLeadId) leadId = gateLeadId
      } else if (!hasFeature) {
        return new Output(true, [], [], { skipped: "feature_disabled" })
      }

      return new Output(true, [], [], {
        profileId,
        eventType: radarEventType,
        created: eventCreated,
        leadId,
        ...(hasFeature ? {} : { skipped: "feature_disabled" }),
      })
    } catch (error) {
      console.error("[SyncPublicFormMetricToRadarUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao espelhar métrica de formulário no Radar"
      return new Output(false, [], [message], null)
    }
  }

  private extractStringOriginField(origin: unknown, field: string): string | null {
    if (!origin || typeof origin !== "object") return null
    const raw = (origin as Record<string, unknown>)[field]
    if (typeof raw !== "string" || !raw.trim()) return null
    return raw.trim()
  }

  private extractCampaignId(origin: unknown): string | null {
    return this.extractStringOriginField(origin, "campaignId")
  }

  private async mergeVisitorSessionIfDifferent(
    teamId: string,
    visitorSessionId: string,
    identifiedProfileId: string,
  ): Promise<void> {
    const anonIdentity = await radarRepository.findProfileByIdentity(
      teamId,
      "visitor_session",
      visitorSessionId,
    )
    if (anonIdentity && anonIdentity.profileId !== identifiedProfileId) {
      await radarRepository.mergeProfiles(teamId, anonIdentity.profileId, identifiedProfileId)
      console.info("[SyncPublicFormMetricToRadarUseCase][D2] perfil anônimo reconciliado", {
        visitorSessionId,
        anonProfileId: anonIdentity.profileId,
        identifiedProfileId,
      })
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

    const recipientEmail = this.extractStringOriginField(input.origin, "recipientEmail")
    if (recipientEmail) {
      const emailValidation = evaluateEmailForAudience(recipientEmail)
      if (emailValidation.ok) {
        const { profile } = await radarRepository.resolveProfileForEmail({
          teamId: input.teamId,
          normalizedEmail: emailValidation.email,
          emailValue: recipientEmail,
          displayName: null,
          normalizedName: normalizeRadarName(emailValidation.email.split("@")[0]),
          emailSource: "email_campaign_form",
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        return profile.id
      }
    }

    // D2: onBlur — quando o valor de um campo de e-mail ou telefone chega via
    // answerValue, tenta resolver o perfil identificado e mescla o perfil
    // anônimo da sessão nele (achado #5 do code review 2026-08-19).
    const answerMappingKey = input.answerMappingKey?.trim() || null
    const answerValue = input.answerValue?.trim() || null

    if (answerMappingKey === "email" && answerValue) {
      const emailValidation = evaluateEmailForAudience(answerValue)
      if (emailValidation.ok) {
        const { profile } = await radarRepository.resolveProfileForEmail({
          teamId: input.teamId,
          normalizedEmail: emailValidation.email,
          emailValue: answerValue,
          displayName: null,
          normalizedName: normalizeRadarName(emailValidation.email.split("@")[0]),
          emailSource: "public_form_answer",
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        await this.mergeVisitorSessionIfDifferent(input.teamId, input.visitorSessionId, profile.id)
        return profile.id
      }
    }

    if (answerMappingKey === "phone" && answerValue) {
      const normalizedPhone = normalizeRadarPhone(answerValue)
      if (normalizedPhone) {
        const { profile } = await radarRepository.resolveProfileForPhone({
          teamId: input.teamId,
          normalizedPhone,
          displayPhone: answerValue,
          phoneValue: answerValue,
          phoneSource: "public_form_answer",
          displayName: "",
          normalizedName: "",
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        await this.mergeVisitorSessionIfDifferent(input.teamId, input.visitorSessionId, profile.id)
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
