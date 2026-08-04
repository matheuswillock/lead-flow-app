import { after } from "next/server"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { syncFinalizedToRadarUseCase } from "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"

/**
 * Dispara o sync inline do Radar para titulares/dependentes de um
 * `LeadFinalized` (D14), fire-and-forget. Gated por `teamHasRadarFeature`.
 */
export function syncFinalizedToRadarInline(input: {
  teamId: string | null | undefined
  finalizedId?: string
  leadId?: string
}): void {
  const { teamId, finalizedId, leadId } = input
  if (!teamId) return
  if (!finalizedId && !leadId) return

  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncFinalizedToRadarUseCase.execute({ teamId, finalizedId, leadId })
    } catch (error) {
      console.error("[syncFinalizedToRadarInline]", error)
    }
  })
}
