/**
 * Contadores denormalizados de campanha/disparo são **cache**; a verdade são os
 * logs (`corretor_studio_email_logs`). Este módulo é a regra pura que decide o
 * que é divergência e quanto vale o delta — a agregação vive no repositório e a
 * orquestração no `ReconcileCampaignCountersUseCase`.
 *
 * Motivo de existir: em 2026-08-24 a auditoria mediu `totalSent` divergente em
 * 28 campanhas (Σ 42.292) e `totalDelivered > totalSent` exibível na lista.
 */

/**
 * Contadores reconciliáveis a partir dos logs.
 *
 * `totalRecipients` **não** está aqui, nem na campanha nem no disparo. Ele é o
 * tamanho *planejado* da audiência, não a cardinalidade dos logs: quem lê é
 * `campaign-dispatch-terminal.ts`, que calcula
 * `failedCount = totalRecipients - totalSent` e usa o campo como denominador na
 * lista. Recomputá-lo como distinto de destinatários materializados encolheria
 * o denominador de uma campanha com materialização parcial — 400/500 no lugar
 * de 400/2000 — fazendo uma campanha `partially_sent` parecer mais completa do
 * que foi e subestimando a contagem de falhas.
 *
 * A DA1 da SPEC 20 pedia o recompute; a revisão do PR #1071 mostrou o consumidor
 * e a decisão foi revertida. Divergência registrada na nota da SPEC.
 */
export type CampaignCounters = {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
}

/** Mesma população de contadores no nível do disparo. */
export type DispatchCounters = CampaignCounters

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
  /**
   * Valores lidos no snapshot. Viajam junto para a escrita poder exigir que a
   * linha ainda esteja neles — concorrência otimista contra o webhook.
   */
  expected: TCounters
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
  return { id: snapshot.id, counters: snapshot.computed, expected: snapshot.current, delta }
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
