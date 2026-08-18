import { describe, expect, it } from "bun:test"
import { isCampaignFailedRetry } from "./campaign-dispatch-copy"
import {
  CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL,
  CAMPAIGN_DISPATCH_COUNTDOWN_START_SECONDS,
  CAMPAIGN_DISPATCH_COUNTDOWN_TICK_MS,
  campaignDispatchCountdownSequence,
  formatCampaignDispatchCountdownLabel,
  nextCampaignDispatchCountdownStep,
  shouldShowCampaignDispatchCountdownLoader,
} from "./campaign-dispatch-countdown"

describe("campaign dispatch countdown", () => {
  it("começa em 5s e avança 5→1→Disparado", () => {
    expect(CAMPAIGN_DISPATCH_COUNTDOWN_START_SECONDS).toBe(5)
    expect(CAMPAIGN_DISPATCH_COUNTDOWN_TICK_MS).toBe(1000)
    expect(campaignDispatchCountdownSequence(false)).toEqual([
      "Disparando em 5 segundos",
      "Disparando em 4 segundos",
      "Disparando em 3 segundos",
      "Disparando em 2 segundos",
      "Disparando em 1 segundo",
      "Disparado",
    ])
  })

  it("next tick: 1 vira Disparado e Disparado dispara o POST", () => {
    expect(nextCampaignDispatchCountdownStep(5)).toBe(4)
    expect(nextCampaignDispatchCountdownStep(1)).toBe("dispatched")
    expect(nextCampaignDispatchCountdownStep("dispatched")).toBe("fire")
    expect(formatCampaignDispatchCountdownLabel("dispatched", false)).toBe(
      CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL
    )
    expect(shouldShowCampaignDispatchCountdownLoader(5)).toBe(true)
    expect(shouldShowCampaignDispatchCountdownLoader("dispatched")).toBe(false)
    expect(shouldShowCampaignDispatchCountdownLoader(null)).toBe(false)
  })

  it("retry (totalSent > 0) usa Reenviando falhas, não Disparar", () => {
    const retry = { status: "failed" as const, totalSent: 12 }
    expect(isCampaignFailedRetry(retry)).toBe(true)
    expect(formatCampaignDispatchCountdownLabel(5, true)).toBe(
      "Reenviando falhas em 5 segundos"
    )
    expect(formatCampaignDispatchCountdownLabel("dispatched", true)).toBe("Disparado")
    expect(campaignDispatchCountdownSequence(true)[0]).toContain("Reenviando falhas")
    expect(campaignDispatchCountdownSequence(true)[0]).not.toContain("Disparando em")
  })

  it("failed com 0 enviados usa countdown de Disparar, não Reenviando falhas", () => {
    const listaFria = { status: "failed" as const, totalSent: 0 }
    expect(isCampaignFailedRetry(listaFria)).toBe(false)
    expect(formatCampaignDispatchCountdownLabel(5, false)).toBe(
      "Disparando em 5 segundos"
    )
    expect(campaignDispatchCountdownSequence(false).join(" ")).not.toContain(
      "Reenviando falhas"
    )
  })

  it("no tick Disparado o POST não é awaited no botão", () => {
    let handleSendResolved = false
    const handleSend = () =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          handleSendResolved = true
          resolve()
        }, 5_000)
      })

    expect(nextCampaignDispatchCountdownStep("dispatched")).toBe("fire")
    void handleSend()
    expect(handleSendResolved).toBe(false)
  })
})
