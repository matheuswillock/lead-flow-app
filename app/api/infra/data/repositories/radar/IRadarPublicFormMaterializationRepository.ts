import type { PublicFormMaterializationOutcome } from "@/lib/radar/public-form-materialization"
import type { RadarIdentityField } from "@/lib/radar/public-form-identity-projection"

export type MaterializePublicFormAnswerInput = {
  teamId: string
  profileId: string
  formId: string
  publicationId: string
  questionId: string
  value: unknown
  mappingKey: string | null
  answeredAt: Date
  sourceEventId: string
}

export type MaterializePublicFormAnswerResult = {
  outcome: PublicFormMaterializationOutcome | "profile_not_found"
  /** Campo de identidade cuja projeção materializada realmente mudou. */
  identityChanged: RadarIdentityField | null
  /** Preenchido apenas quando a projeção de e-mail mudou de valor normalizado. */
  emailChange: {
    previousNormalizedEmail: string | null
    nextEmail: string
    nextNormalizedEmail: string
  } | null
}

/**
 * Materialização de respostas de formulário público na projeção do
 * `RadarProfile`. A implementação mantém lock por `teamId + profileId`,
 * recarrega o perfil dentro da transação e faz deep merge apenas da pergunta
 * alterada.
 */
export interface IRadarPublicFormMaterializationRepository {
  materializePublicFormAnswer(
    input: MaterializePublicFormAnswerInput,
  ): Promise<MaterializePublicFormAnswerResult>
}

export type ReconcileAnsweredEmailInput = {
  teamId: string
  profileId: string
  email: string
  normalizedEmail: string
  occurredAt: Date
}

export type ReconcileAnsweredEmailResult = {
  winningProfileId: string
  merged: boolean
  conflict: boolean
}

/**
 * Reconciliação do e-mail respondido com o perfil que já é dono daquele
 * endereço. Locks dos dois perfis são adquiridos em ordem determinística de ID
 * para evitar deadlock entre consumers concorrentes.
 */
export interface IRadarAnsweredEmailReconciliationRepository {
  reconcileAnsweredEmail(
    input: ReconcileAnsweredEmailInput,
  ): Promise<ReconcileAnsweredEmailResult>
}
