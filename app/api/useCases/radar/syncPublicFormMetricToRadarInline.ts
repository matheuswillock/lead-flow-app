import { after } from "next/server"
import type { PublicFormMetricType } from "@prisma/client"
import type { SyncPublicFormMetricToRadarInput } from "@/app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase"
import { syncPublicFormMetricToRadarUseCase } from "@/app/api/useCases/radar/syncPublicFormMetricToRadarFactory"

/**
 * Espelha um `PublicFormMetricEvent` já persistido em `RadarEvent` (D8).
 * Fire-and-forget via `after()` — na Vercel, promise solta com `.catch()` pode
 * ser encerrada antes de completar quando a resposta HTTP já foi enviada.
 */
export function syncPublicFormMetricToRadarInline(
  input: SyncPublicFormMetricToRadarInput & { teamId: string | null | undefined },
): void {
  const teamId = input.teamId
  if (!teamId) return
  if (!input.eventKey || !input.visitorSessionId || !input.eventType) return

  after(async () => {
    try {
      const output = await syncPublicFormMetricToRadarUseCase.execute({
        ...input,
        teamId,
        eventType: input.eventType as PublicFormMetricType | string,
      })
      if (!output.isValid) {
        throw new Error(
          output.errorMessages.join("; ") || "Falha ao sincronizar formulário no Radar",
        )
      }
    } catch (error) {
      console.error("[syncPublicFormMetricToRadarInline]", error)
      throw error
    }
  })
}
