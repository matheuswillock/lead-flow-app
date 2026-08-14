import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import {
  enqueueRadarProfileSync,
  type EnqueueRadarProfileSyncOptions,
} from "@/app/api/useCases/radar/enqueueRadarProfileSync"

/**
 * Dispara o sync CRM → Radar. Publica na fila `radar-profile-sync`
 * (sem `after()`). O caller deve `await`.
 */
export async function syncLeadToRadarInline(
  leadId: string,
  teamId: string | null | undefined,
  options: EnqueueRadarProfileSyncOptions = {}
): Promise<void> {
  if (!teamId) return
  try {
    await enqueueRadarProfileSync(
      { source: "crm", teamId, sourceId: leadId },
      {
        ...options,
        fallback:
          options.fallback ??
          (async () => {
            await syncLeadToRadarUseCase.execute({ leadId, teamId })
          }),
      }
    )
  } catch (error) {
    console.error("[syncLeadToRadarInline]", error)
  }
}
