import type { PanelSubscriptionRecord } from "@/app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/IBackofficeSubscriptionsPanelRepository"

export interface AsaasSubscriptionsPanelEnrichment {
  sampledCount: number
  mismatchCount: number
}

/**
 * Enriquecimento Asaas do painel (E4, DA5) — a verdade local nunca depende
 * disto. Quando indisponível, o UseCase MUST capturar o erro e devolver
 * `partial: true` sem tocar nas métricas locais (T-50.11).
 */
export interface IBackofficeSubscriptionsPanelAsaasEnricher {
  enrich(records: PanelSubscriptionRecord[]): Promise<AsaasSubscriptionsPanelEnrichment>
}
