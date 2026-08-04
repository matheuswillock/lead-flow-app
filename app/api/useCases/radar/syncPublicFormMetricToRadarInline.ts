import { after } from "next/server"
import type { PublicFormMetricType } from "@prisma/client"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import {
  syncPublicFormMetricToRadarUseCase,
  type SyncPublicFormMetricToRadarInput,
} from "@/app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase"

/**
 * Espelha um `PublicFormMetricEvent` já persistido em `RadarEvent` (D8).
 * Fire-and-forget via `after()` — na Vercel, promise solta com `.catch()` pode
 * ser encerrada antes de completar quando a resposta HTTP já foi enviada.
 */
export function syncPublicFormMetricToRadarInline(
  input: SyncPublicFormMetricToRadarInput & { teamId: string | null | undefined }
): void {
  const teamId = input.teamId
  if (!teamId) return
  if (!input.eventKey || !input.visitorSessionId || !input.eventType) return

  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncPublicFormMetricToRadarUseCase.execute({
        ...input,
        teamId,
        eventType: input.eventType as PublicFormMetricType | string,
      })
    } catch (error) {
      console.error("[syncPublicFormMetricToRadarInline]", error)
    }
  })
}
