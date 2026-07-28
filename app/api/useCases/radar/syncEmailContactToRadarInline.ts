import { after } from "next/server"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import { syncEmailContactToRadarUseCase } from "@/app/api/useCases/radar/SyncEmailContactToRadarUseCase"

export function syncEmailContactToRadarInline(emailContactId: string, teamId: string | null | undefined): void {
  if (!teamId) return
  after(async () => {
    try {
      const hasFeature = await teamHasRadarFeature(teamId)
      if (!hasFeature) return
      await syncEmailContactToRadarUseCase.execute({ emailContactId, teamId })
    } catch (error) {
      console.error("[syncEmailContactToRadarInline]", error)
    }
  })
}
