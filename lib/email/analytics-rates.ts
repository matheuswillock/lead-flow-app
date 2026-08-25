/** Taxa percentual com 2 casas; denominador 0 → 0 (sem divisão por zero). */
export function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100
}

export function buildRates(totals: {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  /** Ausente em recortes que ainda não carregam contador de falha → taxa 0. */
  failed?: number
}) {
  const failed = totals.failed ?? 0

  return {
    deliverabilityRate: safeRate(totals.delivered, totals.sent),
    openRate: safeRate(totals.opened, totals.sent),
    clickRate: safeRate(totals.clicked, totals.sent),
    bounceRate: safeRate(totals.bounced, totals.sent),
    complainRate: safeRate(totals.complained, totals.sent),
    /**
     * Denominador é a tentativa de envio (`sent + failed`), não `sent`: quando a
     * quota estoura, `sent` despenca junto com o sucesso e uma taxa sobre `sent`
     * passaria de 100%, ou ficaria indefinida num período em que nada saiu.
     */
    failureRate: safeRate(failed, totals.sent + failed),
  }
}
