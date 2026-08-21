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
