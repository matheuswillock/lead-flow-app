import { Output } from "@/lib/output"
import { radarService, type RadarService } from "@/app/api/services/radar/RadarService"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

interface SyncEmailContactToRadarInput {
  emailContactId: string
  teamId: string
}

interface SyncEmailContactToRadarOptions {
  radarService?: RadarService
}

class SyncEmailContactToRadarUseCase {
  async execute(
    input: SyncEmailContactToRadarInput,
    options?: SyncEmailContactToRadarOptions
  ): Promise<Output> {
    try {
      const service = options?.radarService ?? radarService
      const scope: RadarTeamScope = {
        teamId: input.teamId,
        // ctx não é lido pelos caminhos de sync (syncFromEmail) — mantido só
        // para satisfazer o tipo RadarTeamScope.
        ctx: { profileId: "system", teamMember: { role: "system", functions: [] } },
      }
      const result = await service.syncFromEmail(scope, { emailContactId: input.emailContactId })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncEmailContactToRadarUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao sincronizar contato de e-mail com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncEmailContactToRadarUseCase = new SyncEmailContactToRadarUseCase()
