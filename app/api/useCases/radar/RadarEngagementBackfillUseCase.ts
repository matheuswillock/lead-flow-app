import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

const BATCH_SIZE = 500
const UPDATE_CONCURRENCY = 5

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    await Promise.all(chunk.map((item) => worker(item)))
  }
}

/**
 * D19-C: recalcula engagementScore/engagementBand em lotes de 500 perfis
 * (todos os times). Um POST processa o máximo possível em uma invocação.
 */
class RadarEngagementBackfillUseCase {
  async execute(): Promise<Output> {
    try {
      let processed = 0
      let cursorId: string | null = null
      let batches = 0

      for (;;) {
        const batch = await radarRepository.listProfilesForEngagementBackfill({
          take: BATCH_SIZE,
          cursorId,
        })
        if (batch.length === 0) break

        await runWithConcurrency(batch, UPDATE_CONCURRENCY, async (profile) => {
          await radarRepository.updateEngagementScore(profile.id, profile.teamId)
        })

        processed += batch.length
        batches += 1
        cursorId = batch[batch.length - 1]?.id ?? null

        if (batch.length < BATCH_SIZE) break
      }

      console.info("[RadarEngagementBackfillUseCase][execute]", { processed, batches })
      return new Output(true, ["Backfill de engajamento concluído"], [], {
        processed,
        batches,
        batchSize: BATCH_SIZE,
        updateConcurrency: UPDATE_CONCURRENCY,
      })
    } catch (error) {
      console.error("[RadarEngagementBackfillUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro no backfill de engajamento do Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const radarEngagementBackfillUseCase = new RadarEngagementBackfillUseCase()
