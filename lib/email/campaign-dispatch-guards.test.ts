import { describe, expect, it } from "bun:test"
import {
  checkDispatchWindow,
  isResendDomainSendCapable,
  resolveCampaignStatusAfterDispatch,
} from "./campaign-dispatch-guards"

describe("isResendDomainSendCapable", () => {
  it("permite verified e partially_verified", () => {
    expect(isResendDomainSendCapable("verified")).toBe(true)
    expect(isResendDomainSendCapable("partially_verified")).toBe(true)
  })

  it("bloqueia status pendente ou falho", () => {
    expect(isResendDomainSendCapable("pending")).toBe(false)
    expect(isResendDomainSendCapable("not_started")).toBe(false)
    expect(isResendDomainSendCapable("failed")).toBe(false)
    expect(isResendDomainSendCapable("temporary_failure")).toBe(false)
    expect(isResendDomainSendCapable("partially_failed")).toBe(false)
    expect(isResendDomainSendCapable(null)).toBe(false)
    expect(isResendDomainSendCapable(undefined)).toBe(false)
  })
})

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
