import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import type { RadarProfileSyncPayload } from "@/lib/queues/radar-profile-sync"

const RADAR_PROFILE_SYNC_QUEUE_PUBLISH_FAILED_TAG = "radar_profile_sync_queue_publish_failed"

type PublishRadarProfileSync = (
  payload: RadarProfileSyncPayload
) => Promise<{ messageId: string | null }>

async function defaultPublish(payload: RadarProfileSyncPayload): Promise<{ messageId: string | null }> {
  const { publishRadarProfileSync } = await import("@/lib/queues/radar-profile-sync")
  return publishRadarProfileSync(payload)
}

export type EnqueueRadarProfileSyncOptions = {
  publish?: PublishRadarProfileSync
  hasFeature?: typeof teamHasRadarFeature
  fallback?: () => Promise<unknown>
}

/**
 * Publica o sync na fila. Se o publish falhar, executa o fallback síncrono.
 * Sem `after()` — o caller deve `await` para o `queue.send` completar no isolate.
 */
export async function enqueueRadarProfileSync(
  payload: RadarProfileSyncPayload,
  options: EnqueueRadarProfileSyncOptions = {}
): Promise<void> {
  const publish = options.publish ?? defaultPublish
  const hasFeature = options.hasFeature ?? teamHasRadarFeature
  if (!(await hasFeature(payload.teamId))) return

  try {
    await publish(payload)
  } catch (error) {
    console.error(`[enqueueRadarProfileSync] ${RADAR_PROFILE_SYNC_QUEUE_PUBLISH_FAILED_TAG}`, error)
    if (options.fallback) {
      await options.fallback()
      return
    }
    throw error
  }
}
