import { createHash } from "node:crypto"
import { buildAttributionEventKeySuffix } from "@/lib/public-forms/origin"

export type PublicFormCompletionMetricType =
  | "form_completed"
  | "lead_created"
  | "lead_attached"
  | "meeting_scheduled"

/** Stable submit idempotency key for a visitor session. */
export function buildPublicFormSubmitRequestKey(visitorSessionId: string): string {
  return `${visitorSessionId}:submit`
}

/**
 * Stable metric event key so upserts collapse duplicate submits in the same session.
 *
 * `emailLogId` escopa a chave por atribuição de campanha. Sem ele, um
 * destinatário que já tivesse enviado o formulário antes manteria a linha
 * antiga — o upsert é first-write-wins — e a conversão de uma nova campanha
 * seria descartada ou creditada à campanha anterior. Ver
 * `buildAttributionEventKeySuffix`.
 */
export function buildPublicFormMetricEventKey(
  visitorSessionId: string,
  eventType: PublicFormCompletionMetricType,
  emailLogId?: string | null,
): string {
  return `${visitorSessionId}:${eventType}${buildAttributionEventKeySuffix(emailLogId)}`
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
