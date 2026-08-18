import { afterEach, describe, expect, it, spyOn } from "bun:test"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { listRadarSegmentEmailRecipientPage } from "./list-segment-recipients"

describe("listRadarSegmentEmailRecipientPage", () => {
  const spies: Array<{ mockRestore: () => void }> = []

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore()
  })

  it("segmento fixo hidrata só a janela de profile IDs", async () => {
    const ids = ["p0", "p1", "p2", "p3"]
    spies.push(
      spyOn(radarRepository, "listProfileIdsForSegmentation").mockResolvedValue(ids)
    )
    const byIds = spyOn(radarRepository, "listProfilesForSegmentationByIds").mockResolvedValue([])
    spies.push(byIds)
    const all = spyOn(radarRepository, "listProfilesForSegmentation").mockResolvedValue([])
    spies.push(all)
    spies.push(spyOn(radarRepository, "findLeadStatuses").mockResolvedValue(new Map()))

    const page = await listRadarSegmentEmailRecipientPage("team-1", "email_marketable", {
      skip: 2,
      take: 2,
    })

    expect(all).not.toHaveBeenCalled()
    expect(byIds).toHaveBeenCalledTimes(1)
    expect(byIds.mock.calls[0]?.slice(0, 2)).toEqual(["team-1", ["p2", "p3"]])
    expect(page.exhausted).toBe(true)
  })
})
