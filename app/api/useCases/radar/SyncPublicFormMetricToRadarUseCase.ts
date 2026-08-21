import type { PublicFormMetricType, Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import type {
  IRadarProfileMergeRepository,
  IRadarPublicFormProfileRepository,
} from "@/app/api/infra/data/repositories/radar/IRadarPublicFormProfileRepository"
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"
import { normalizeRadarName, normalizeRadarPhone } from "@/lib/radar/normalization"
import {
  mapPublicFormMetricToRadarEventType,
  PUBLIC_FORM_RADAR_SOURCE_TYPE,
} from "@/lib/radar/map-public-form-metric-to-radar-event"
import {
  resolvePublicFormLeadGateMode,
  type PublicFormLeadGateMode,
} from "@/lib/public-forms/public-form-lead-gate-mode"

type OutputUseCase<TInput> = { execute(input: TInput): Promise<Output> }
type LeadSyncInput = { leadId: string; teamId: string }
type GateInput = {
  teamId: string
  formId: string
  visitorSessionId: string
  radarProfileId: string
  eventId: string
  origin?: Record<string, unknown>
}
type EligibilityInput = { teamId: string; radarProfileId: string }

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
  answerMappingKey?: string | null
  answerValue?: unknown
  leadGateRequest?: "none" | "identity_revision"
  occurredAt?: Date
}

export class SyncPublicFormMetricToRadarUseCase {
  constructor(
    private readonly radarProfiles: IRadarPublicFormProfileRepository &
      IRadarProfileMergeRepository,
    private readonly leadSync: OutputUseCase<LeadSyncInput>,
    private readonly leadGate: OutputUseCase<GateInput>,
    private readonly eligibility: OutputUseCase<EligibilityInput>,
    private readonly resolveGateMode: (
      teamId: string,
    ) => PublicFormLeadGateMode = resolvePublicFormLeadGateMode,
  ) {}

  async execute(input: SyncPublicFormMetricToRadarInput): Promise<Output> {
    try {
      const radarEventType = mapPublicFormMetricToRadarEventType(input.eventType)
      if (!radarEventType) return new Output(true, [], [], { skipped: "unknown_event_type" })

      const profileId = await this.resolveProfileId(input)
      if (!profileId) return new Output(false, [], ["Perfil Radar não resolvido"], null)

      if (
        input.eventType === "question_answered" &&
        input.answerMappingKey === "name" &&
        typeof input.answerValue === "string" &&
        input.answerValue.trim()
      ) {
        await this.radarProfiles.applyFormAnswerDisplayName(
          profileId,
          input.teamId,
          input.answerValue.trim(),
        )
      }

      const occurredAt = input.occurredAt ?? new Date()
      const campaignId = this.extractOriginString(input.origin, "campaignId")
      const metadata: Prisma.InputJsonValue = {
        formId: input.formId,
        publicationId: input.publicationId,
        ...(campaignId ? { campaignId } : {}),
        ...(input.questionId ? { questionId: input.questionId } : {}),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.answerMappingKey ? { mappingKey: input.answerMappingKey } : {}),
        ...(input.answerValue !== undefined
          ? { answerValue: JSON.parse(JSON.stringify(input.answerValue)) as Prisma.InputJsonValue }
          : {}),
        ...(input.origin && typeof input.origin === "object"
          ? { origin: input.origin as Prisma.InputJsonValue }
          : {}),
      }
      const event = await this.radarProfiles.appendEventIfNewBySourceKey({
        profileId,
        teamId: input.teamId,
        eventType: radarEventType,
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: input.eventKey,
        occurredAt,
        metadata,
      })

      let leadId = input.leadId ?? null
      if (
        input.eventType === "question_answered" &&
        input.leadGateRequest === "identity_revision"
      ) {
        const gateOutput = await this.executeGateByMode(input, profileId)
        if (!gateOutput.isValid) return gateOutput
        const gateLeadId = this.extractLeadId(gateOutput)
        if (gateLeadId) leadId = gateLeadId
      }

      console.info("[SyncPublicFormMetricToRadarUseCase][execute] evento sincronizado", {
        eventKey: input.eventKey,
        visitorSessionId: input.visitorSessionId,
        questionId: input.questionId ?? null,
        profileId,
        eventType: radarEventType,
        eventCreated: Boolean(event),
        gateMode: this.resolveGateMode(input.teamId),
      })
      return new Output(true, [], [], {
        profileId,
        eventType: radarEventType,
        created: Boolean(event),
        leadId,
      })
    } catch (error) {
      console.error("[SyncPublicFormMetricToRadarUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao espelhar métrica de formulário no Radar"
      return new Output(false, [], [message], null)
    }
  }

  private async executeGateByMode(
    input: SyncPublicFormMetricToRadarInput,
    radarProfileId: string,
  ): Promise<Output> {
    const mode = this.resolveGateMode(input.teamId)
    if (mode === "legacy") return new Output(true, [], [], { skipped: "legacy_mode" })
    if (mode === "shadow") {
      const evaluation = await this.eligibility.execute({ teamId: input.teamId, radarProfileId })
      if (evaluation.isValid) {
        const decision = evaluation.result as {
          eligible?: boolean
          reason?: string
        } | null
        await this.radarProfiles.appendEventIfNewBySourceKey({
          profileId: radarProfileId,
          teamId: input.teamId,
          eventType: "radar.crm_lead_gate_shadow",
          sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
          sourceId: `${input.eventKey}:shadow`,
          occurredAt: input.occurredAt ?? new Date(),
          metadata: {
            mode: "shadow",
            eligible: decision?.eligible ?? false,
            reason: decision?.reason ?? "unknown",
          },
        })
        console.info("[SyncPublicFormMetricToRadarUseCase][shadow] decisão calculada", {
          teamId: input.teamId,
          formId: input.formId,
          radarProfileId,
          eventId: input.eventKey,
          decision,
        })
      }
      return evaluation
    }
    return this.leadGate.execute({
      teamId: input.teamId,
      formId: input.formId,
      visitorSessionId: input.visitorSessionId,
      radarProfileId,
      eventId: input.eventKey,
      origin:
        input.origin && typeof input.origin === "object"
          ? (input.origin as Record<string, unknown>)
          : {},
    })
  }

  private extractLeadId(output: Output): string | null {
    if (!output.result || typeof output.result !== "object" || !("leadId" in output.result)) {
      return null
    }
    const leadId = (output.result as { leadId?: unknown }).leadId
    return typeof leadId === "string" ? leadId : null
  }

  private extractOriginString(origin: unknown, field: string): string | null {
    if (!origin || typeof origin !== "object") return null
    const raw = (origin as Record<string, unknown>)[field]
    return typeof raw === "string" && raw.trim() ? raw.trim() : null
  }

  private async mergeVisitorSessionIfDifferent(input: {
    teamId: string
    visitorSessionId: string
    identifiedProfileId: string
    eventId: string
    occurredAt: Date
  }): Promise<string> {
    const anonymousIdentity = await this.radarProfiles.findProfileByIdentity(
      input.teamId,
      "visitor_session",
      input.visitorSessionId,
    )
    if (!anonymousIdentity || anonymousIdentity.profileId === input.identifiedProfileId) {
      return input.identifiedProfileId
    }
    const merge = await this.radarProfiles.mergePublicFormProfiles(
      input.teamId,
      anonymousIdentity.profileId,
      input.identifiedProfileId,
    )
    if (merge.conflict) {
      await this.radarProfiles.appendEventIfNewBySourceKey({
        profileId: input.identifiedProfileId,
        teamId: input.teamId,
        eventType: "radar.crm_identity_conflict",
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        sourceId: `${input.eventId}:profile_merge_conflict`,
        occurredAt: input.occurredAt,
        metadata: {
          anonymousProfileId: anonymousIdentity.profileId,
          identifiedProfileId: input.identifiedProfileId,
        },
      })
    }
    return merge.winningProfileId
  }

  private async resolveProfileId(input: SyncPublicFormMetricToRadarInput): Promise<string | null> {
    const leadId = input.leadId?.trim() || null
    if (leadId) {
      let identity = await this.radarProfiles.findProfileByIdentity(input.teamId, "lead_id", leadId)
      if (!identity) {
        const syncOutput = await this.leadSync.execute({ leadId, teamId: input.teamId })
        if (!syncOutput.isValid) {
          throw new Error(
            syncOutput.errorMessages.join("; ") || "Falha ao sincronizar lead no Radar",
          )
        }
        identity = await this.radarProfiles.findProfileByIdentity(input.teamId, "lead_id", leadId)
      }
      if (identity) return identity.profileId
    }

    const mappingKey = input.answerMappingKey?.trim() || null
    const answerValue = typeof input.answerValue === "string" ? input.answerValue.trim() : ""
    const recipientEmail = this.extractOriginString(input.origin, "recipientEmail")
    const recipientEmailValidation = recipientEmail
      ? evaluateEmailForAudience(recipientEmail)
      : null
    if (mappingKey === "email" && answerValue) {
      const validation = evaluateEmailForAudience(answerValue)
      if (validation.ok) {
        const { profile } = await this.radarProfiles.resolveProfileForEmail({
          teamId: input.teamId,
          normalizedEmail: validation.email,
          emailValue: answerValue,
          displayName: null,
          normalizedName: normalizeRadarName(validation.email.split("@")[0]),
          emailSource: "public_form_answer",
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        return this.mergeVisitorSessionIfDifferent({
          teamId: input.teamId,
          visitorSessionId: input.visitorSessionId,
          identifiedProfileId: profile.id,
          eventId: input.eventKey,
          occurredAt: input.occurredAt ?? new Date(),
        })
      }
    }

    if (mappingKey === "phone" && answerValue) {
      const normalizedPhone = normalizeRadarPhone(answerValue)
      if (normalizedPhone) {
        const { profile } = await this.radarProfiles.resolveProfileForPhone({
          teamId: input.teamId,
          normalizedPhone,
          displayPhone: answerValue,
          phoneValue: answerValue,
          phoneSource: "public_form_answer",
          displayName: "",
          normalizedName: "",
          primaryEmail: recipientEmailValidation?.ok ? recipientEmail : null,
          normalizedPrimaryEmail: recipientEmailValidation?.ok
            ? recipientEmailValidation.email
            : null,
          lastSeenAt: input.occurredAt ?? new Date(),
        })
        return this.mergeVisitorSessionIfDifferent({
          teamId: input.teamId,
          visitorSessionId: input.visitorSessionId,
          identifiedProfileId: profile.id,
          eventId: input.eventKey,
          occurredAt: input.occurredAt ?? new Date(),
        })
      }
    }

    if (recipientEmail && recipientEmailValidation?.ok) {
      const { profile } = await this.radarProfiles.resolveProfileForEmail({
        teamId: input.teamId,
        normalizedEmail: recipientEmailValidation.email,
        emailValue: recipientEmail,
        displayName: null,
        normalizedName: normalizeRadarName(recipientEmailValidation.email.split("@")[0]),
        emailSource: "email_campaign_form",
        lastSeenAt: input.occurredAt ?? new Date(),
      })
      return profile.id
    }

    const { profile } = await this.radarProfiles.resolveProfileForVisitorSession({
      teamId: input.teamId,
      visitorSession: input.visitorSessionId,
      lastSeenAt: input.occurredAt ?? new Date(),
    })
    return profile.id
  }
}
