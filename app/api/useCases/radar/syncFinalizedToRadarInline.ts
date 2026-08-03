import { after } from "next/server"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { syncFinalizedToRadarUseCase } from "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"

/**
 * D14: dispara o sync do Radar para titulares/dependentes de um LeadFinalized, fire-and-forget.
 * Gate: verifica `teamHasRadarFeature` antes de qualquer operação.
 */
export function syncFinalizedToRadarInline(finalizedId: string, teamId: string | null | undefined): void {
  if (!teamId) return
  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncFinalizedToRadarUseCase.execute(
        teamId,
        { profileId: "system", teamMember: { role: "system", functions: [] } },
        finalizedId
      )
    } catch (error) {
      console.error("[syncFinalizedToRadarInline]", error)
    }
  })
}
