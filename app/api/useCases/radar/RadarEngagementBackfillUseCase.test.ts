import { describe, expect, it, mock } from "bun:test"
import { radarEngagementBackfillUseCase } from "./RadarEngagementBackfillUseCase"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

describe("RadarEngagementBackfillUseCase", () => {
  it("processa perfis do lote em paralelo com concorrência limitada", async () => {
    const profiles = Array.from({ length: 6 }, (_, i) => ({
      id: `profile-${i}`,
      teamId: "team-1",
    }))

    const listSpy = mock(async () => profiles)
    const updateSpy = mock(async () => ({ score: 50, band: "warm" as const }))

    const originalList = radarRepository.listProfilesForEngagementBackfill
    const originalUpdate = radarRepository.updateEngagementScore

    radarRepository.listProfilesForEngagementBackfill = listSpy
    radarRepository.updateEngagementScore = updateSpy

    try {
      const output = await radarEngagementBackfillUseCase.execute()
      expect(output.isValid).toBe(true)
      expect(updateSpy).toHaveBeenCalledTimes(6)
    } finally {
      radarRepository.listProfilesForEngagementBackfill = originalList
      radarRepository.updateEngagementScore = originalUpdate
    }
  })
})
