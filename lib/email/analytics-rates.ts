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

/**
 * Taxas de coorte: numerador e denominador na mesma população.
 *
 * Todos os campos aqui são contagens de coorte, não de evento — ver
 * `COHORT_FILTER_CLAUSES`. Misturar os dois faz `openRate` passar de 100% numa
 * janela com aberturas de e-mails antigos.
 */
export function buildRates(totals: {
  sent: number
  /** Da coorte enviada: quantos foram entregues. */
  delivered: number
  /** Da coorte ENTREGUE: quantos foram abertos (D6). */
  opened: number
  /** Denominador do openRate: tamanho da coorte de entregas da janela. */
  deliveredCohort?: number
  /** Da coorte enviada: quantos foram abertos (base antiga, transição 30d). */
  openedOnSent?: number
  clicked: number
  bounced: number
  complained: number
  /** Ausente em recortes que ainda não carregam contador de falha → taxa 0. */
  failed?: number
}) {
  const failed = totals.failed ?? 0
  // Recortes sem coorte separada (disparo, ranking) reusam `delivered` nas duas
  // pontas: ali numerador e denominador já vêm do mesmo contador acumulado.
  const deliveredCohort = totals.deliveredCohort ?? totals.delivered
  const openedOnSent = totals.openedOnSent ?? totals.opened

  return {
    deliverabilityRate: safeRate(totals.delivered, totals.sent),
    /**
     * Denominador é `delivered`, padrão do mercado e do painel do Resend (D6).
     *
     * Com `/sent` os dois nunca fechavam: quem comparasse as telas lado a lado
     * via números diferentes para o mesmo fato e precisava de explicação toda
     * vez. A troca move a série histórica para cima — na campanha "Agro - sul",
     * 22,40% → 25,86% sem nada ter mudado no mundo real.
     */
    openRate: safeRate(totals.opened, deliveredCohort),
    /**
     * A base antiga, exposta em paralelo pelos 30 dias de transição para a
     * mudança ser conferível em vez de aparecer como salto inexplicado. Sai
     * quando a UI e os relatórios tiverem migrado.
     */
    openRateOnSent: safeRate(openedOnSent, totals.sent),
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
