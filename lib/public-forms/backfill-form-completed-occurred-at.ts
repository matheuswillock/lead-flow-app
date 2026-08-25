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
  /** Atribuição de campanha da submissão (`origin.emailLogId`). */
  emailLogId: string | null
}

export type ClocklessMetricEvent = {
  id: string
  eventKey: string
  eventType: string
  visitorSessionId: string
  /** Quando a linha de métrica nasceu — o relógio errado que estamos corrigindo. */
  createdAt: Date
  /** Atribuição do evento, extraída do sufixo `:el:` do `eventKey`. */
  attributionEmailLogId: string | null
  /**
   * TODAS as submissões da sessão, não a primeira.
   *
   * O cookie de sessão vive 30 dias: a mesma sessão produz submissões distintas
   * para campanhas distintas, e pode ter uma casca do dispatcher abandonada
   * antes de um aceite real. Escolher a mais antiga cegamente datava a conversão
   * nova pela antiga — ou herdava a casca e deixava o evento real sem correção,
   * que é exatamente o bug que este backfill existe para matar.
   */
  submissionCandidates: SubmissionAnchor[]
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

/**
 * Relógio do aceite: `dispatchAcceptedAt` primeiro, `createdAt` como reserva.
 *
 * Mesma precedência de `resolveSubmissionAcceptedAt` no UseCase, e pelo mesmo
 * motivo: numa parcial promovida do `/progress`, `createdAt` é o início do
 * preenchimento, não o envio.
 */
export function resolveAcceptedAt(submission: SubmissionAnchor): Date | null {
  return submission.dispatchAcceptedAt ?? submission.createdAt ?? null
}

/**
 * A submissão que originou este evento, entre as da sessão.
 *
 * Ordem de preferência:
 * 1. atribuição idêntica (`emailLogId`) — é a chave que escopa a conversão;
 * 2. a mais recente que já existia quando o evento nasceu;
 * 3. a mais recente de todas.
 *
 * Cascas do dispatcher só entram se não houver nenhum aceite real na sessão —
 * aí o evento é legitimamente fabricado e será pulado como tal.
 */
export function selectSubmissionForEvent(event: ClocklessMetricEvent): SubmissionAnchor | null {
  if (event.submissionCandidates.length === 0) return null

  const real = event.submissionCandidates.filter(
    (candidate) => !isFabricatedByDispatcher(candidate)
  )
  const pool = real.length > 0 ? real : event.submissionCandidates

  if (event.attributionEmailLogId) {
    const sameAttribution = pool.filter(
      (candidate) => candidate.emailLogId === event.attributionEmailLogId
    )
    if (sameAttribution.length > 0) return latestBefore(sameAttribution, event.createdAt)
  }

  return latestBefore(pool, event.createdAt)
}

/** Mais recente entre as que precedem o corte; sem nenhuma, a mais antiga do conjunto. */
function latestBefore(candidates: SubmissionAnchor[], cutoff: Date): SubmissionAnchor {
  const byCreatedAtAsc = [...candidates].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  )
  const preceding = byCreatedAtAsc.filter(
    (candidate) => (candidate.createdAt?.getTime() ?? 0) <= cutoff.getTime()
  )
  return preceding.at(-1) ?? byCreatedAtAsc[0]
}

export function planFormCompletedOccurredAtBackfill(
  events: ClocklessMetricEvent[]
): OccurredAtBackfillPlan {
  const updates: PlannedOccurredAtUpdate[] = []
  const skipped: SkippedOccurredAtEvent[] = []

  for (const event of events) {
    const identity = { eventId: event.id, eventKey: event.eventKey }
    const submission = selectSubmissionForEvent(event)

    if (!submission) {
      skipped.push({ ...identity, reason: "submissao_nao_encontrada" })
      continue
    }
    if (isFabricatedByDispatcher(submission)) {
      skipped.push({ ...identity, reason: "fabricada_pelo_dispatcher" })
      continue
    }

    const occurredAt = resolveAcceptedAt(submission)
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
