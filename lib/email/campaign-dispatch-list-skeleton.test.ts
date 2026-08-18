import { describe, expect, it } from "bun:test"
import { shouldShowCampaignListSkeleton } from "./campaign-dispatch-list-skeleton"

describe("shouldShowCampaignListSkeleton", () => {
  it("primeiro load sem linhas mostra skeleton", () => {
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: false,
        isAwaitingSendingAfterDispatch: false,
      })
    ).toBe(true)
  })

  it("poll de 4s com linhas existentes não mostra skeleton", () => {
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: true,
        isAwaitingSendingAfterDispatch: false,
      })
    ).toBe(false)
  })

  it("uma passada após Disparado mostra skeleton até o GET sending", () => {
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: true,
        isAwaitingSendingAfterDispatch: true,
      })
    ).toBe(true)
  })

  it("troca de time com lista zerada mostra skeleton (não flasha o time antigo)", () => {
    const campaignsAfterTeamChange: unknown[] = []
    expect(
      shouldShowCampaignListSkeleton({
        hasExistingRows: campaignsAfterTeamChange.length > 0,
        isAwaitingSendingAfterDispatch: false,
      })
    ).toBe(true)
  })
})
