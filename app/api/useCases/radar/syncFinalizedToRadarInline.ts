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

/**
 * Um único `after()` para importações em lote — evita N callbacks
 * (até PORTFOLIO_IMPORT_MAX_ROWS) cada um repetindo feature-check + queries.
 */
export function syncFinalizedToRadarInlineBatch(input: {
  teamId: string | null | undefined
  leadIds: string[]
}): void {
  const teamId = input.teamId
  if (!teamId) return
  const leadIds = [...new Set(input.leadIds.filter((id) => Boolean(id)))]
  if (leadIds.length === 0) return

  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncFinalizedToRadarUseCase.execute({ teamId, leadIds })
    } catch (error) {
      console.error("[syncFinalizedToRadarInlineBatch]", error)
    }
  })
}
