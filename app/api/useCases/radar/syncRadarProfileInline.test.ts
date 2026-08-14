import { describe, it, expect, mock, beforeEach } from "bun:test"
import { syncLeadToRadarInline } from "@/app/api/useCases/radar/syncLeadToRadarInline"
import { syncPortfolioToRadarInline } from "@/app/api/useCases/radar/syncPortfolioToRadarInline"
import { syncFinalizedToRadarInline } from "@/app/api/useCases/radar/syncFinalizedToRadarInline"

describe("radar profile-sync publishers", () => {
  const publish = mock(async () => ({ messageId: "mid-1" }))
  const hasFeature = mock(async () => true)
  const fallback = mock(async () => {})

  beforeEach(() => {
    publish.mockClear()
    hasFeature.mockClear()
    fallback.mockClear()
    publish.mockImplementation(async () => ({ messageId: "mid-1" }))
    hasFeature.mockImplementation(async () => true)
    fallback.mockImplementation(async () => undefined)
  })

  it("syncLeadToRadarInline publica source=crm e não usa after()", async () => {
    await syncLeadToRadarInline("lead-1", "team-1", { publish, hasFeature, fallback })
    expect(publish).toHaveBeenCalledWith({ source: "crm", teamId: "team-1", sourceId: "lead-1" })
    expect(fallback).not.toHaveBeenCalled()
  })

  it("syncPortfolioToRadarInline publica source=portfolio", async () => {
    await syncPortfolioToRadarInline("port-1", "team-1", { publish, hasFeature, fallback })
    expect(publish).toHaveBeenCalledWith({
      source: "portfolio",
      teamId: "team-1",
      sourceId: "port-1",
    })
  })

  it("syncFinalizedToRadarInline publica source=finalized", async () => {
    await syncFinalizedToRadarInline(
      { teamId: "team-1", finalizedId: "fin-1" },
      { publish, hasFeature, fallback }
    )
    expect(publish).toHaveBeenCalledWith({
      source: "finalized",
      teamId: "team-1",
      sourceId: "fin-1",
      leadId: undefined,
    })
  })

  it("publish falhou dispara fallback", async () => {
    publish.mockRejectedValue(new Error("queue down"))
    await syncLeadToRadarInline("lead-1", "team-1", { publish, hasFeature, fallback })
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it("sem feature: não publica", async () => {
    hasFeature.mockResolvedValue(false)
    await syncLeadToRadarInline("lead-1", "team-1", { publish, hasFeature, fallback })
    expect(publish).not.toHaveBeenCalled()
  })
})
