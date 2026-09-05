import { createAsaasClient } from "@/lib/asaas/asaas-client"
import type { PanelSubscriptionRecord } from "@/app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/IBackofficeSubscriptionsPanelRepository"
import type {
  AsaasSubscriptionsPanelEnrichment,
  IBackofficeSubscriptionsPanelAsaasEnricher,
} from "./IBackofficeSubscriptionsPanelAsaasEnricher"

/**
 * Amostra em vez de N chamadas em toda request — um endpoint de painel não
 * pode bloquear no tamanho da base. `sampledCount`/`mismatchCount` dão um
 * spot-check de divergência de status; reconciliação completa fica fora do
 * MVP (open question #3 de [[50 — Backoffice de Cobrança — Backend]]).
 */
const ENRICHMENT_SAMPLE_CAP = 20

export class BackofficeSubscriptionsPanelAsaasEnricher implements IBackofficeSubscriptionsPanelAsaasEnricher {
  async enrich(records: PanelSubscriptionRecord[]): Promise<AsaasSubscriptionsPanelEnrichment> {
    const sample = records
      .filter((r) => !r.hasPermanentSubscription && r.asaasSubscriptionId && r.subscriptionStatus)
      .slice(0, ENRICHMENT_SAMPLE_CAP)

    if (sample.length === 0) {
      return { sampledCount: 0, mismatchCount: 0 }
    }

    const results = await Promise.allSettled(
      sample.map(async (record) => {
        const client = createAsaasClient(record.asaasSubscriptionAccount)
        const response = await client.request(`${client.endpoints.subscriptions}/${record.asaasSubscriptionId}`)
        const asaasActive = response?.status === "ACTIVE"
        const localActive = record.subscriptionStatus === "active"
        return asaasActive !== localActive
      })
    )

    const succeeded = results.filter(
      (result): result is PromiseFulfilledResult<boolean> => result.status === "fulfilled"
    )

    if (succeeded.length === 0) {
      throw new Error("Nenhuma verificação Asaas do painel de assinaturas teve sucesso")
    }

    return {
      sampledCount: succeeded.length,
      mismatchCount: succeeded.filter((result) => result.value).length,
    }
  }
}

export const backofficeSubscriptionsPanelAsaasEnricher = new BackofficeSubscriptionsPanelAsaasEnricher()
