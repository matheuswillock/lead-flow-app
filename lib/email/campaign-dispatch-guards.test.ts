import { describe, expect, it } from "bun:test"
import { checkDispatchWindow, resolveCampaignStatusAfterDispatch } from "./campaign-dispatch-guards"

describe("checkDispatchWindow", () => {
  it("permite disparo dentro da janela no fuso America/Sao_Paulo", () => {
    const now = new Date("2026-07-06T14:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchTimeFrom: "08:00",
      dispatchTimeTo: "18:00",
    })
    expect(result.blocked).toBe(false)
  })

  it("adianta campanha fora da janela em vez de falhar", () => {
    const now = new Date("2026-07-06T02:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchTimeFrom: "08:00",
      dispatchTimeTo: "18:00",
    })
    expect(result.blocked).toBe(true)
    if (result.blocked) {
      expect(result.defer).toBe(true)
      expect(result.reason).toContain("Fora da janela")
    }
  })

  it("bloqueia data específica com defer", () => {
    const now = new Date("2026-07-06T15:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchBlockedDates: [{ date: "2026-07-06" }],
    })
    expect(result.blocked).toBe(true)
    if (result.blocked) {
      expect(result.defer).toBe(true)
    }
  })
})

describe("resolveCampaignStatusAfterDispatch", () => {
  it("marca sent apenas quando sent > 0", () => {
    expect(resolveCampaignStatusAfterDispatch(3).campaignStatus).toBe("sent")
    expect(resolveCampaignStatusAfterDispatch(0).campaignStatus).toBe("failed")
    expect(resolveCampaignStatusAfterDispatch(0).errorMessage).toBeTruthy()
  })

  it("usa detalhe de falha quando enviado", () => {
    expect(resolveCampaignStatusAfterDispatch(0, "422 — Invalid `to`").errorMessage).toBe(
      "422 — Invalid `to`"
    )
  })
})
