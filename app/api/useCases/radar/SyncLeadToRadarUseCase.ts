import { Output } from "@/lib/output"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

interface SyncLeadToRadarInput {
  leadId: string
  teamId: string
}

class SyncLeadToRadarUseCase {
  async execute(input: SyncLeadToRadarInput): Promise<Output> {
    try {
      const scope: RadarTeamScope = {
        teamId: input.teamId,
        // ctx não é lido pelos caminhos de sync (syncFromCrm) — mantido só
        // para satisfazer o tipo RadarTeamScope.
        ctx: { profileId: "system", teamMember: { role: "system", functions: [] } },
      }
      const result = await radarService.syncFromCrm(scope, { leadId: input.leadId })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncLeadToRadarUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar lead com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncLeadToRadarUseCase = new SyncLeadToRadarUseCase()
