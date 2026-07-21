import { describe, expect, it } from "bun:test"
import {
  buildSubCampaignScheduledAts,
  chunkContactIdsForSubCampaigns,
  estimateSubCampaignCount,
  requiresSubCampaignSplit,
} from "@/lib/email/campaign-sub-campaigns"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"

describe("campaign-sub-campaigns", () => {
  it("requiresSubCampaignSplit when count exceeds 2000", () => {
    expect(requiresSubCampaignSplit(2000)).toBe(false)
    expect(requiresSubCampaignSplit(2001)).toBe(true)
  })

  it("chunks contact ids into batches of 2000", () => {
    const ids = Array.from({ length: 4500 }, (_, index) => `id-${index}`)
    const chunks = chunkContactIdsForSubCampaigns(ids)
    expect(chunks).toHaveLength(3)
    expect(chunks[0].size).toBe(EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB)
    expect(chunks[1].size).toBe(EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB)
    expect(chunks[2].size).toBe(500)
    expect(chunks[0].index).toBe(1)
    expect(chunks[2].index).toBe(3)
    expect(chunks[2].contactIds[0]).toBe("id-4000")
  })

  it("builds daily paced scheduledAts", () => {
    const start = new Date("2026-08-01T15:00:00.000Z")
    const dates = buildSubCampaignScheduledAts(start, 3, 1)
    expect(dates).toHaveLength(3)
    expect(dates[0].toISOString()).toBe("2026-08-01T15:00:00.000Z")
    expect(dates[1].toISOString()).toBe("2026-08-02T15:00:00.000Z")
    expect(dates[2].toISOString()).toBe("2026-08-03T15:00:00.000Z")
  })

  it("rejects invalid interval or empty chunks", () => {
    expect(buildSubCampaignScheduledAts(new Date(), 2, 0)).toEqual([])
    expect(chunkContactIdsForSubCampaigns([])).toEqual([])
    expect(estimateSubCampaignCount(4500)).toBe(3)
  })
})
