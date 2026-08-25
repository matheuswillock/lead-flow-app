import { createHash } from "node:crypto"
import { buildAttributionEventKeySuffix } from "@/lib/public-forms/origin"

export type PublicFormCompletionMetricType =
  | "form_completed"
  | "lead_created"
  | "lead_attached"
  | "meeting_scheduled"

/**
 * Stable submit idempotency key for a visitor session.
 *
 * `emailLogId` escopa a chave por atribuição pelo mesmo motivo de
 * `buildPublicFormMetricEventKey` — e aqui o efeito é pior. `requestKey` é
 * `@unique` em `PublicFormSubmission`, e o `accept()` devolve
 * "Respostas já recebidas" quando acha uma submissão completa com a mesma
 * chave. Sem o escopo, o mesmo navegador convertendo por uma segunda campanha
 * dentro dos 30 dias do cookie de sessão bate nesse curto-circuito: nenhuma
 * submissão nova nasce, e portanto NENHUMA métrica é gerada — o escopo do
 * `eventKey` nem chega a ser alcançado.
 */
export function buildPublicFormSubmitRequestKey(
  visitorSessionId: string,
  emailLogId?: string | null,
): string {
  return `${visitorSessionId}:submit${buildAttributionEventKeySuffix(emailLogId)}`
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

/**
 * Recusa de validação medida no servidor (SPEC 40 E1). O sufixo `:server`
 * separa esta linha do `form_validation_failed` que o renderer emite, para o
 * funil distinguir "o cliente barrou" de "o servidor recusou o POST".
 *
 * Chave estável por sessão **e formulário**: o upsert é first-write-wins, então
 * N tentativas inválidas da mesma sessão no mesmo form contam como uma sessão
 * recusada — um bot martelando o endpoint não infla a série.
 *
 * O `formId` entra porque `eventKey` é `@unique` global e o `visitorSessionId`
 * do POST direto não é garantidamente exclusivo de um formulário (review
 * #1030): sem o escopo, a recusa no form A ocupa a chave e a recusa no form B
 * pela mesma sessão vira no-op — a métrica do B fica subcontada.
 */
export function buildPublicFormServerValidationFailedEventKey(
  formId: string,
  visitorSessionId: string,
  emailLogId?: string | null,
): string {
  return `${visitorSessionId}:form_validation_failed:server:${formId}${buildAttributionEventKeySuffix(
    emailLogId,
  )}`
}

/**
 * Descarte de lead (SPEC 40 E2/DA2). A chave sai do `requestKey`, não do
 * `visitorSessionId`: `requestKey` é `@unique` em `PublicFormSubmission`, então
 * é a única coisa que identifica **esta** submissão. O drain reprocessando o
 * mesmo job cai no mesmo `eventKey` e o upsert absorve — sem isso, cada
 * reentrega da fila somaria um descarte a mais no funil.
 */
export function buildPublicFormLeadDiscardedEventKey(
  requestKey: string,
  emailLogId?: string | null,
): string {
  return `${requestKey}:lead_discarded${buildAttributionEventKeySuffix(emailLogId)}`
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
