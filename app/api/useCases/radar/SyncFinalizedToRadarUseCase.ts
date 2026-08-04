import { Output } from "@/lib/output"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"

interface SyncFinalizedToRadarInput {
  teamId: string
  finalizedId?: string
  leadId?: string
  leadIds?: string[]
}

class SyncFinalizedToRadarUseCase {
  async execute(input: SyncFinalizedToRadarInput): Promise<Output> {
    try {
      const leadIds = input.leadIds?.filter((id) => Boolean(id)) ?? []
      if (!input.finalizedId && !input.leadId && leadIds.length === 0) {
        return new Output(false, [], ["finalizedId, leadId ou leadIds é obrigatório"], null)
      }

      const scope: RadarTeamScope = {
        teamId: input.teamId,
        // ctx não é lido pelos caminhos de sync (syncFromFinalized) — mantido só
        // para satisfazer o tipo RadarTeamScope.
        ctx: { profileId: "system", teamMember: { role: "system", functions: [] } },
      }
      const result = await radarService.syncFromFinalized(scope, {
        ...(input.finalizedId ? { finalizedId: input.finalizedId } : {}),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(leadIds.length > 0 ? { leadIds } : {}),
      })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[SyncFinalizedToRadarUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao sincronizar contrato finalizado com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncFinalizedToRadarUseCase = new SyncFinalizedToRadarUseCase()
