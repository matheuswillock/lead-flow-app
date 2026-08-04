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
}) {
  return {
    deliverabilityRate: safeRate(totals.delivered, totals.sent),
    openRate: safeRate(totals.opened, totals.sent),
    clickRate: safeRate(totals.clicked, totals.sent),
    bounceRate: safeRate(totals.bounced, totals.sent),
    complainRate: safeRate(totals.complained, totals.sent),
  }
}
