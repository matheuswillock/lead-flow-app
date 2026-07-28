import { Output } from "@/lib/output"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

interface SyncPortfolioToRadarInput {
  portfolioId: string
  teamId: string
}

class SyncPortfolioToRadarUseCase {
  async execute(input: SyncPortfolioToRadarInput): Promise<Output> {
    try {
      const scope: RadarTeamScope = {
        teamId: input.teamId,
        // ctx não é lido pelos caminhos de sync (syncFromPortfolio) — mantido só
        // para satisfazer o tipo RadarTeamScope.
        ctx: { profileId: "system", teamMember: { role: "system", functions: [] } },
      }
      const result = await radarService.syncFromPortfolio(scope, { portfolioId: input.portfolioId })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncPortfolioToRadarUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar carteira com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncPortfolioToRadarUseCase = new SyncPortfolioToRadarUseCase()
