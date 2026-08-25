/**
 * Plano do backfill de `occurredAt` dos eventos de conversão server-side.
 *
 * Os eventos emitidos por `processInBackground` nasceram sem `occurredAt` até a
 * correção de 2026-08-24 (SPEC 30 — DA3): o analytics os datava pelo `createdAt`
 * da linha, que é o instante em que a fila drenou. Este módulo decide, para cada
 * evento órfão de relógio, qual data é a verdadeira — e quais NÃO devem ser
 * corrigidos.
 *
 * A lógica vive separada do script para ser testável: a regra de exclusão é o
 * ponto delicado, não a escrita.
 */

/**
 * `requestKey` de submissão criada pelo `/progress` (parcial em andamento).
 *
 * Um aceite real sobrescreve este `requestKey` pelo do POST — é o que
 * `finalizeProgressSubmission` faz ao promover a parcial. Logo, `progress:`
 * sobrevivente significa que ninguém enviou o formulário: a submissão foi
 * completada pela varredura do cron de despacho (SPEC 40 — E0), e o
 * `form_completed` correspondente é fabricado.
 */
export const FABRICATED_SUBMISSION_REQUEST_KEY_PREFIX = "progress:"

export type SubmissionAnchor = {
  id: string
  requestKey: string
  createdAt: Date | null
  dispatchAcceptedAt: Date | null
}

export type ClocklessMetricEvent = {
  id: string
  eventKey: string
  eventType: string
  visitorSessionId: string
  submission: SubmissionAnchor | null
}

export type BackfillSkipReason =
  | "submissao_nao_encontrada"
  | "fabricada_pelo_dispatcher"
  | "sem_ancora_de_aceite"

export type PlannedOccurredAtUpdate = {
  eventId: string
  eventKey: string
  occurredAt: Date
}

export type SkippedOccurredAtEvent = {
  eventId: string
  eventKey: string
  reason: BackfillSkipReason
}

export type OccurredAtBackfillPlan = {
  updates: PlannedOccurredAtUpdate[]
  skipped: SkippedOccurredAtEvent[]
}

/**
 * Casca do dispatcher: nunca recebeu envio, então não tem data de conversão para
 * corrigir. Datá-la pelo `createdAt` da parcial inventaria uma conversão que não
 * aconteceu — pior que o relógio errado.
 */
export function isFabricatedByDispatcher(submission: SubmissionAnchor): boolean {
  return submission.requestKey.startsWith(FABRICATED_SUBMISSION_REQUEST_KEY_PREFIX)
}

/** Relógio do aceite: `createdAt` da submissão, `dispatchAcceptedAt` como reserva. */
export function resolveAcceptedAt(submission: SubmissionAnchor): Date | null {
  return submission.createdAt ?? submission.dispatchAcceptedAt ?? null
}

export function planFormCompletedOccurredAtBackfill(
  events: ClocklessMetricEvent[]
): OccurredAtBackfillPlan {
  const updates: PlannedOccurredAtUpdate[] = []
  const skipped: SkippedOccurredAtEvent[] = []

  for (const event of events) {
    const identity = { eventId: event.id, eventKey: event.eventKey }

    if (!event.submission) {
      skipped.push({ ...identity, reason: "submissao_nao_encontrada" })
      continue
    }
    if (isFabricatedByDispatcher(event.submission)) {
      skipped.push({ ...identity, reason: "fabricada_pelo_dispatcher" })
      continue
    }

    const occurredAt = resolveAcceptedAt(event.submission)
    if (!occurredAt) {
      skipped.push({ ...identity, reason: "sem_ancora_de_aceite" })
      continue
    }

    updates.push({ ...identity, occurredAt })
  }

  return { updates, skipped }
}

export function summarizeSkipReasons(
  skipped: SkippedOccurredAtEvent[]
): Record<BackfillSkipReason, number> {
  const summary: Record<BackfillSkipReason, number> = {
    submissao_nao_encontrada: 0,
    fabricada_pelo_dispatcher: 0,
    sem_ancora_de_aceite: 0,
  }
  for (const item of skipped) summary[item.reason] += 1
  return summary
}
