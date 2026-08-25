/**
 * Contadores denormalizados de campanha/disparo são **cache**; a verdade são os
 * logs (`corretor_studio_email_logs`). Este módulo é a regra pura que decide o
 * que é divergência e quanto vale o delta — a agregação vive no repositório e a
 * orquestração no `ReconcileCampaignCountersUseCase`.
 *
 * Motivo de existir: em 2026-08-24 a auditoria mediu `totalSent` divergente em
 * 28 campanhas (Σ 42.292) e `totalDelivered > totalSent` exibível na lista.
 */

/** Contadores de campanha reconciliáveis a partir dos logs. */
export type CampaignCounters = {
  /** Destinatários distintos materializados (não o planejado da audiência). */
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
}

/**
 * Disparo não reconcilia `totalRecipients`: ele guarda o planejado do lote, que
 * a finalização da fila usa como denominador. Recomputar viraria outra métrica.
 */
export type DispatchCounters = Omit<CampaignCounters, "totalRecipients">

export type CounterSnapshot<TCounters> = {
  id: string
  /** O que a linha denormalizada afirma hoje. */
  current: TCounters
  /** O que os logs dizem. */
  computed: TCounters
}

export type CounterFix<TCounters> = {
  id: string
  counters: TCounters
  /** Soma dos módulos das diferenças por campo — o "quanto o cache mentia". */
  delta: number
}

/**
 * Devolve `null` quando cache e logs já batem: linha sem divergência **não** é
 * escrita, senão o cron carimbaria `updatedAt` de campanha saudável toda noite.
 */
export function diffCounters<TCounters extends Record<string, number>>(
  snapshot: CounterSnapshot<TCounters>
): CounterFix<TCounters> | null {
  const delta = sumAbsoluteDifferences(snapshot.current, snapshot.computed)
  if (delta === 0) return null
  return { id: snapshot.id, counters: snapshot.computed, delta }
}

function sumAbsoluteDifferences<TCounters extends Record<string, number>>(
  current: TCounters,
  computed: TCounters
): number {
  let total = 0
  for (const key of Object.keys(computed) as Array<keyof TCounters>) {
    total += Math.abs(Number(computed[key]) - Number(current[key]))
  }
  return total
}
