import { after } from "next/server"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { syncPortfolioToRadarUseCase } from "@/app/api/useCases/radar/SyncPortfolioToRadarUseCase"

/**
 * Dispara o sync inline do Radar para uma carteira, fire-and-forget.
 * Compartilhado por todo ponto que escreve `LeadPortfolio` (PortfolioUseCase
 * e a finalização de contrato) — extraído para função standalone em vez de
 * método privado de uma única classe depois que um segundo caminho de
 * escrita apareceu (finalize/route.ts) sem essa chamada.
 */
export function syncPortfolioToRadarInline(portfolioId: string, teamId: string | null | undefined): void {
  if (!teamId) return
  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncPortfolioToRadarUseCase.execute({ portfolioId, teamId })
    } catch (error) {
      console.error("[syncPortfolioToRadarInline]", error)
    }
  })
}
