import { syncFinalizedToRadarUseCase } from "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"
import {
  enqueueRadarProfileSync,
  type EnqueueRadarProfileSyncOptions,
} from "@/app/api/useCases/radar/enqueueRadarProfileSync"

/**
 * Dispara o sync do Radar para titulares/dependentes de um `LeadFinalized`.
 * Publica na fila `radar-profile-sync` (sem `after()`). O caller deve `await`.
 */
export async function syncFinalizedToRadarInline(
  input: {
    teamId: string | null | undefined
    finalizedId?: string
    leadId?: string
  },
  options: EnqueueRadarProfileSyncOptions = {}
): Promise<void> {
  const { teamId, finalizedId, leadId } = input
  if (!teamId) return
  if (!finalizedId && !leadId) return

  try {
    await enqueueRadarProfileSync(
      { source: "finalized", teamId, sourceId: finalizedId, leadId },
      {
        ...options,
        fallback:
          options.fallback ??
          (async () => {
            await syncFinalizedToRadarUseCase.execute({ teamId, finalizedId, leadId })
          }),
      }
    )
  } catch (error) {
    console.error("[syncFinalizedToRadarInline]", error)
  }
}

/**
 * Um único publish para importações em lote — evita N mensagens
 * (até PORTFOLIO_IMPORT_MAX_ROWS).
 */
export async function syncFinalizedToRadarInlineBatch(
  input: {
    teamId: string | null | undefined
    leadIds: string[]
  },
  options: EnqueueRadarProfileSyncOptions = {}
): Promise<void> {
  const teamId = input.teamId
  if (!teamId) return
  const leadIds = [...new Set(input.leadIds.filter((id) => Boolean(id)))]
  if (leadIds.length === 0) return

  try {
    await enqueueRadarProfileSync(
      { source: "finalized", teamId, leadIds },
      {
        ...options,
        fallback:
          options.fallback ??
          (async () => {
            await syncFinalizedToRadarUseCase.execute({ teamId, leadIds })
          }),
      }
    )
  } catch (error) {
    console.error("[syncFinalizedToRadarInlineBatch]", error)
  }
}
