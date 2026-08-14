import { syncPortfolioToRadarUseCase } from "@/app/api/useCases/radar/SyncPortfolioToRadarUseCase"
import {
  enqueueRadarProfileSync,
  type EnqueueRadarProfileSyncOptions,
} from "@/app/api/useCases/radar/enqueueRadarProfileSync"

/**
 * Dispara o sync inline do Radar para uma carteira.
 * Compartilhado por todo ponto que escreve `LeadPortfolio`.
 * Publica na fila `radar-profile-sync` (sem `after()`). O caller deve `await`.
 */
export async function syncPortfolioToRadarInline(
  portfolioId: string,
  teamId: string | null | undefined,
  options: EnqueueRadarProfileSyncOptions = {}
): Promise<void> {
  if (!teamId) return
  try {
    await enqueueRadarProfileSync(
      { source: "portfolio", teamId, sourceId: portfolioId },
      {
        ...options,
        fallback:
          options.fallback ??
          (async () => {
            await syncPortfolioToRadarUseCase.execute({ portfolioId, teamId })
          }),
      }
    )
  } catch (error) {
    console.error("[syncPortfolioToRadarInline]", error)
  }
}
