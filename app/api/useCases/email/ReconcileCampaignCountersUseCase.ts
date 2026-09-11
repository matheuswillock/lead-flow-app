import { Output } from "@/lib/output"
import {
  diffCounters,
  type CampaignCounters,
  type CounterFix,
  type CounterSnapshot,
  type DispatchCounters,
} from "@/lib/email/campaign-counter-reconciliation"
import {
  emailCampaignRepository,
  type IEmailCampaignRepository,
} from "@/app/api/infra/data/repositories/emailCampaign/EmailCampaignRepository"

/** Só o que a reconciliação precisa do repositório (ISP). */
export type ICampaignCounterReconciliationRepository = Pick<
  IEmailCampaignRepository,
  | "findCampaignCounterSnapshots"
  | "findDispatchCounterSnapshots"
  | "applyCampaignCounterFixes"
  | "applyDispatchCounterFixes"
>

export type ReconcileCampaignCountersOptions = {
  /**
   * Quanto tempo uma linha `sending` precisa ficar parada antes de ser
   * reconciliável. Enquanto o disparo está em voo o webhook incrementa os
   * mesmos contadores — corrigir ali é corrida, não conserto.
   */
  inFlightWindowMs?: number
  batchSize?: number
}

export type ReconcileCampaignCountersSummary = {
  campaignCandidates: number
  campaignsFixed: number
  campaignDelta: number
  /** Linhas que um webhook mexeu entre a leitura e a escrita — voltam amanhã. */
  campaignsSkipped: number
  dispatchCandidates: number
  dispatchesFixed: number
  dispatchDelta: number
  dispatchesSkipped: number
  /** Lote cheio: sobrou divergência para a próxima execução. */
  truncated: boolean
}

const DEFAULT_IN_FLIGHT_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_BATCH_SIZE = 500

/**
 * Contador denormalizado é cache com dono: toda noite este passe recomputa
 * `total*` de campanha e disparo a partir dos logs e corrige a divergência.
 *
 * O delta reportado é sinal de saúde, não estatística: delta persistente noite
 * após noite significa que o incremento no caminho quente está errado, e é isso
 * que se caça — não o número que o cron consertou.
 */
export class ReconcileCampaignCountersUseCase {
  private readonly inFlightWindowMs: number
  private readonly batchSize: number

  constructor(
    private readonly repository: ICampaignCounterReconciliationRepository = emailCampaignRepository,
    options: ReconcileCampaignCountersOptions = {}
  ) {
    this.inFlightWindowMs = options.inFlightWindowMs ?? DEFAULT_IN_FLIGHT_WINDOW_MS
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  }

  async execute(): Promise<Output> {
    const inFlightWatermark = new Date(Date.now() - this.inFlightWindowMs)
    const query = { limit: this.batchSize, inFlightWatermark }

    const campaignSnapshots = await this.repository.findCampaignCounterSnapshots(query)
    const campaignFixes = collectFixes(campaignSnapshots)
    const campaignsFixed =
      campaignFixes.length > 0
        ? await this.repository.applyCampaignCounterFixes(campaignFixes)
        : 0

    const dispatchSnapshots = await this.repository.findDispatchCounterSnapshots(query)
    const dispatchFixes = collectFixes(dispatchSnapshots)
    const dispatchesFixed =
      dispatchFixes.length > 0
        ? await this.repository.applyDispatchCounterFixes(dispatchFixes)
        : 0

    // `*Fixed` conta o que o banco confirmou, não o que tentamos: a escrita é
    // otimista e uma linha que o webhook mexeu no intervalo é pulada de
    // propósito. Ela volta ao lote da próxima noite.
    const campaignsSkipped = campaignFixes.length - campaignsFixed
    const dispatchesSkipped = dispatchFixes.length - dispatchesFixed
    if (campaignsSkipped > 0 || dispatchesSkipped > 0) {
      console.info(
        "[ReconcileCampaignCountersUseCase] Correções puladas por escrita concorrente",
        { campaignsSkipped, dispatchesSkipped }
      )
    }

    const summary: ReconcileCampaignCountersSummary = {
      campaignCandidates: campaignSnapshots.length,
      campaignsFixed,
      campaignDelta: sumDelta(campaignFixes),
      campaignsSkipped,
      dispatchCandidates: dispatchSnapshots.length,
      dispatchesFixed,
      dispatchDelta: sumDelta(dispatchFixes),
      dispatchesSkipped,
      truncated:
        campaignSnapshots.length >= this.batchSize || dispatchSnapshots.length >= this.batchSize,
    }

    if (summary.truncated) {
      console.info(
        "[ReconcileCampaignCountersUseCase] Lote cheio — divergência remanescente para a próxima execução",
        { batchSize: this.batchSize, ...summary }
      )
    }

    console.info("[ReconcileCampaignCountersUseCase] Execução concluída", summary)

    return new Output(
      true,
      [
        `${summary.campaignsFixed} campanha(s) e ${summary.dispatchesFixed} disparo(s) reconciliado(s)`,
      ],
      [],
      summary
    )
  }
}

function collectFixes<TCounters extends Record<string, number>>(
  snapshots: CounterSnapshot<TCounters>[]
): CounterFix<TCounters>[] {
  return snapshots
    .map((snapshot) => diffCounters(snapshot))
    .filter((fix): fix is CounterFix<TCounters> => fix !== null)
}

function sumDelta(fixes: Array<{ delta: number }>): number {
  return fixes.reduce((total, fix) => total + fix.delta, 0)
}

export type { CampaignCounters, DispatchCounters }

export const reconcileCampaignCountersUseCase = new ReconcileCampaignCountersUseCase()
