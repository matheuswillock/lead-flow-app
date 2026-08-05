import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

const BATCH_SIZE = 500

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

        for (const profile of batch) {
          await radarRepository.updateEngagementScore(profile.id, profile.teamId)
        }

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
