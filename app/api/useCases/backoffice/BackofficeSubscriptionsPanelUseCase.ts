import { Output } from "@/lib/output"
import type {
  IBackofficeSubscriptionsPanelRepository,
  PanelSubscriptionRecord,
} from "@/app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/IBackofficeSubscriptionsPanelRepository"
import type {
  AsaasSubscriptionsPanelEnrichment,
  IBackofficeSubscriptionsPanelAsaasEnricher,
} from "@/app/api/services/backofficeSubscriptionsPanel/IBackofficeSubscriptionsPanelAsaasEnricher"
import { backofficeSubscriptionsPanelRepository } from "@/app/api/infra/data/repositories/backoffice/SubscriptionsPanelRepository/BackofficeSubscriptionsPanelRepository"
import { backofficeSubscriptionsPanelAsaasEnricher } from "@/app/api/services/backofficeSubscriptionsPanel/BackofficeSubscriptionsPanelAsaasEnricher"

const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  quadrimester: 4,
  semiannual: 6,
  annual: 12,
}

const MS_PER_DAY = 86_400_000

export interface PanelSummary {
  byStatus: Array<{ status: string; count: number }>
  byProduct: Array<{ productName: string; count: number }>
  byCycle: Array<{ cycle: string; count: number }>
  mrr: number
  dueWindows: { d30: number; d60: number; d90: number }
  permanentCount: number
  memberProExternalCount: number
  /** Anomalia local C4 (§7.3 da auditoria): vencimento posterior ao fim da assinatura. */
  divergenceCount: number
}

/**
 * E4 (§7.8, DA5): verdade local sempre disponível — MRR normalizado por
 * ciclo, vencimentos em janelas 30/60/90, permanentes contados à parte
 * (nunca somados ao MRR), divergência local (C4) exposta como contagem.
 * Pura e testável sem banco (T-50.10).
 */
export function computePanelSummary(
  records: PanelSubscriptionRecord[],
  memberProExternalCount: number,
  now: Date
): PanelSummary {
  const byStatus = new Map<string, number>()
  const byProduct = new Map<string, number>()
  const byCycle = new Map<string, number>()
  let mrr = 0
  let permanentCount = 0
  let d30 = 0
  let d60 = 0
  let d90 = 0
  let divergenceCount = 0

  for (const record of records) {
    if (record.hasPermanentSubscription) {
      permanentCount += 1
      continue
    }

    const statusKey = record.subscriptionStatus ?? "unknown"
    byStatus.set(statusKey, (byStatus.get(statusKey) ?? 0) + 1)

    if (record.cycle) {
      byCycle.set(record.cycle, (byCycle.get(record.cycle) ?? 0) + 1)
    }
    if (record.productName) {
      byProduct.set(record.productName, (byProduct.get(record.productName) ?? 0) + 1)
    }

    if (record.subscriptionStatus === "active" && record.chargedAmount !== null && record.cycle) {
      const months = CYCLE_MONTHS[record.cycle]
      if (months) {
        mrr += record.chargedAmount / months
      }
    }

    if (record.nextDueDate) {
      const daysUntilDue = Math.ceil((record.nextDueDate.getTime() - now.getTime()) / MS_PER_DAY)
      if (daysUntilDue >= 0 && daysUntilDue <= 30) d30 += 1
      else if (daysUntilDue > 30 && daysUntilDue <= 60) d60 += 1
      else if (daysUntilDue > 60 && daysUntilDue <= 90) d90 += 1
    }

    if (
      record.nextDueDate &&
      record.subscriptionEndDate &&
      record.nextDueDate.getTime() > record.subscriptionEndDate.getTime()
    ) {
      divergenceCount += 1
    }
  }

  return {
    byStatus: [...byStatus].map(([status, count]) => ({ status, count })),
    byProduct: [...byProduct].map(([productName, count]) => ({ productName, count })),
    byCycle: [...byCycle].map(([cycle, count]) => ({ cycle, count })),
    mrr: Math.round(mrr * 100) / 100,
    dueWindows: { d30, d60, d90 },
    permanentCount,
    memberProExternalCount,
    divergenceCount,
  }
}

export class BackofficeSubscriptionsPanelUseCase {
  constructor(
    private readonly repository: IBackofficeSubscriptionsPanelRepository = backofficeSubscriptionsPanelRepository,
    private readonly asaasEnricher: IBackofficeSubscriptionsPanelAsaasEnricher = backofficeSubscriptionsPanelAsaasEnricher
  ) {}

  async getSummary(now: Date = new Date()): Promise<Output> {
    try {
      const [records, memberProExternalCount] = await Promise.all([
        this.repository.findActiveMastersForPanel(),
        this.repository.countMemberProExternalAdhesions(),
      ])

      const summary = computePanelSummary(records, memberProExternalCount, now)

      let asaasEnrichment: AsaasSubscriptionsPanelEnrichment | null = null
      let partial = false
      try {
        asaasEnrichment = await this.asaasEnricher.enrich(records)
      } catch (error) {
        console.error("[BackofficeSubscriptionsPanelUseCase][getSummary] enriquecimento Asaas indisponível", error)
        partial = true
      }

      return new Output(true, [], [], {
        ...summary,
        asaasEnrichment,
        partial,
      })
    } catch (error) {
      console.error("[BackofficeSubscriptionsPanelUseCase][getSummary]", error)
      return new Output(false, [], ["Erro ao montar painel de assinaturas"], null)
    }
  }
}

export const backofficeSubscriptionsPanelUseCase = new BackofficeSubscriptionsPanelUseCase()
