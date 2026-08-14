import { Output } from "@/lib/output"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

function systemScope(teamId: string): RadarTeamScope {
  return {
    teamId,
    ctx: { profileId: "system", teamMember: { role: "system", functions: [] } },
  }
}

class SyncRadarProfileDataForTeamUseCase {
  async execute(input: { teamId: string }): Promise<Output> {
    try {
      const result = await radarService.syncProfileDataForTeam(systemScope(input.teamId))
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncRadarProfileDataForTeamUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao sincronizar profileData do Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncRadarProfileDataForTeamUseCase = new SyncRadarProfileDataForTeamUseCase()
