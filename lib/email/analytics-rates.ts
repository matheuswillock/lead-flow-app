/** Taxa percentual com 2 casas; denominador 0 → 0 (sem divisão por zero). */
export function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100
}

/**
 * Cada salto do funil sobre o degrau anterior — nunca sobre `sent`.
 *
 * A taxa que importa é a do salto: "quantos dos que viram o formulário
 * começaram", não "quantos dos 55 mil enviados". Medir tudo contra `sent`
 * achata os últimos degraus em 0,0% e esconde onde o funil realmente morre.
 */
export function buildCampaignFunnelRates(funnel: {
  sent: number
  delivered: number
  opened: number
  clicked: number
  formViewed: number
  formStarted: number
  formCompleted: number
  leadAttached: number
}) {
  return {
    deliveryRate: safeRate(funnel.delivered, funnel.sent),
    openRate: safeRate(funnel.opened, funnel.delivered),
    clickRate: safeRate(funnel.clicked, funnel.opened),
    formViewRate: safeRate(funnel.formViewed, funnel.clicked),
    formStartRate: safeRate(funnel.formStarted, funnel.formViewed),
    formCompletionRate: safeRate(funnel.formCompleted, funnel.formStarted),
    leadRate: safeRate(funnel.leadAttached, funnel.formCompleted),
    /** Ponta a ponta: o número que responde "esta campanha valeu?". */
    sentToLeadRate: safeRate(funnel.leadAttached, funnel.sent),
  }
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
