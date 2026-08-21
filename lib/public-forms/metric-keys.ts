import { createHash } from "node:crypto"

export type PublicFormCompletionMetricType =
  | "form_completed"
  | "lead_created"
  | "lead_attached"
  | "meeting_scheduled"

/** Stable submit idempotency key for a visitor session. */
export function buildPublicFormSubmitRequestKey(visitorSessionId: string): string {
  return `${visitorSessionId}:submit`
}

/** Stable metric event key so upserts collapse duplicate submits in the same session. */
export function buildPublicFormMetricEventKey(
  visitorSessionId: string,
  eventType: PublicFormCompletionMetricType,
): string {
  return `${visitorSessionId}:${eventType}`
}

/** Funil e Radar usam a mesma chave: `{session}:question_answered:{questionId}`. */
export function buildPublicFormQuestionAnsweredEventKey(
  visitorSessionId: string,
  questionId: string,
): string {
  return `${visitorSessionId}:question_answered:${questionId}`
}

/**
 * Idempotency da fila para reavaliar A+C no Radar sem alterar o `eventKey`
 * estável da métrica. Correção de identidade (perda de foco) gera outra
 * entrega; o funil continua first-write no mesmo `eventKey`.
 */
export function buildPublicFormIdentityGateIdempotencyKey(
  eventKey: string,
  answerValue: string,
): string {
  const revision = createHash("sha256").update(answerValue).digest("hex").slice(0, 16)
  return `${eventKey}:rev:${revision}`
}
