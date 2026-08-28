import type { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import type {
  IRadarAnsweredEmailReconciliationRepository,
  IRadarPublicFormMaterializationRepository,
  MaterializePublicFormAnswerResult,
} from "@/app/api/infra/data/repositories/radar/IRadarPublicFormMaterializationRepository"
import type { IRadarPublicFormProfileRepository } from "@/app/api/infra/data/repositories/radar/IRadarPublicFormProfileRepository"
import { PUBLIC_FORM_RADAR_SOURCE_TYPE } from "@/lib/radar/map-public-form-metric-to-radar-event"
import type { RadarIdentityField } from "@/lib/radar/public-form-identity-projection"

export type MaterializePublicFormAnswerRevisionInput = {
  teamId: string
  profileId: string
  formId: string
  publicationId: string
  questionId: string
  questionType: string | null
  mappingKey: string | null
  value: unknown
  eventId: string
  occurredAt: Date
  campaignId?: string | null
}

export type MaterializePublicFormAnswerRevisionResult = {
  profileId: string
  outcome: MaterializePublicFormAnswerResult["outcome"]
  identityChanged: RadarIdentityField | null
}

type MaterializationRepository = IRadarPublicFormMaterializationRepository &
  IRadarAnsweredEmailReconciliationRepository &
  Pick<IRadarPublicFormProfileRepository, "appendEventIfNewBySourceKey">

/**
 * PR 3 — Radar/CDP como proprietário da materialização.
 *
 * Cada revisão de resposta gera um `RadarEvent` append-only e é projetada em
 * `profileData.publicForms[formId].answers[questionId]`. O gate só é sinalizado
 * quando nome, telefone ou e-mail materializado realmente mudou; respostas
 * não-identitárias materializam sem disparar promoção ao CRM.
 *
 * Nenhuma PII entra em log: apenas IDs técnicos, `mappingKey` e o desfecho.
 */
export class MaterializePublicFormAnswerRevisionUseCase {
  constructor(private readonly repository: MaterializationRepository) {}

  async execute(input: MaterializePublicFormAnswerRevisionInput): Promise<Output> {
    try {
      await this.appendRevisionEvent(input)

      const materialization = await this.repository.materializePublicFormAnswer({
        teamId: input.teamId,
        profileId: input.profileId,
        formId: input.formId,
        publicationId: input.publicationId,
        questionId: input.questionId,
        value: input.value,
        mappingKey: input.mappingKey,
        answeredAt: input.occurredAt,
        sourceEventId: input.eventId,
      })

      const profileId = materialization.emailChange
        ? await this.reconcileAnsweredEmail(input, materialization)
        : input.profileId

      console.info("[MaterializePublicFormAnswerRevisionUseCase][execute] revisão materializada", {
        teamId: input.teamId,
        formId: input.formId,
        publicationId: input.publicationId,
        questionId: input.questionId,
        eventId: input.eventId,
        profileId,
        mappingKey: input.mappingKey,
        outcome: materialization.outcome,
        identityChanged: materialization.identityChanged,
      })

      return new Output(true, [], [], {
        profileId,
        outcome: materialization.outcome,
        identityChanged: materialization.identityChanged,
      } satisfies MaterializePublicFormAnswerRevisionResult)
    } catch (error) {
      console.error("[MaterializePublicFormAnswerRevisionUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao materializar revisão de resposta no Radar"
      return new Output(false, [], [message], null)
    }
  }

  /**
   * RadarEvent append-only da revisão: carrega IDs técnicos, pergunta, tipo,
   * `mappingKey`, valor JSON tipado, `occurredAt`, `eventId` e o contexto
   * derivado da campanha. Deduplicado pelo `eventId` causal.
   */
  private async appendRevisionEvent(
    input: MaterializePublicFormAnswerRevisionInput,
  ): Promise<void> {
    const metadata: Prisma.InputJsonValue = {
      formId: input.formId,
      publicationId: input.publicationId,
      questionId: input.questionId,
      questionType: input.questionType,
      mappingKey: input.mappingKey,
      value: (input.value ?? null) as Prisma.InputJsonValue,
      eventId: input.eventId,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    }
    await this.repository.appendEventIfNewBySourceKey({
      profileId: input.profileId,
      teamId: input.teamId,
      eventType: "public_form.answer_revision",
      sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
      sourceId: `${input.eventId}:${input.questionId}`,
      occurredAt: input.occurredAt,
      metadata,
    })
  }

  /**
   * E-mail respondido vira o principal do perfil. O e-mail herdado da campanha
   * permanece como identidade/fonte de atribuição — a reconciliação apenas
   * decide qual perfil é canônico. A troca real gera exatamente um
   * `profile.email_changed`, deduplicado pelo `eventId`.
   */
  private async reconcileAnsweredEmail(
    input: MaterializePublicFormAnswerRevisionInput,
    materialization: MaterializePublicFormAnswerResult,
  ): Promise<string> {
    const change = materialization.emailChange
    if (!change) return input.profileId

    const reconciliation = await this.repository.reconcileAnsweredEmail({
      teamId: input.teamId,
      profileId: input.profileId,
      email: change.nextEmail,
      normalizedEmail: change.nextNormalizedEmail,
      occurredAt: input.occurredAt,
    })

    await this.repository.appendEventIfNewBySourceKey({
      profileId: reconciliation.winningProfileId,
      teamId: input.teamId,
      eventType: reconciliation.conflict
        ? "radar.crm_identity_conflict"
        : "profile.email_changed",
      sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
      sourceId: `${input.eventId}:email_changed`,
      occurredAt: input.occurredAt,
      metadata: {
        formId: input.formId,
        questionId: input.questionId,
        eventId: input.eventId,
        hadPreviousEmail: Boolean(change.previousNormalizedEmail),
        merged: reconciliation.merged,
        conflict: reconciliation.conflict,
      },
    })

    return reconciliation.winningProfileId
  }
}
