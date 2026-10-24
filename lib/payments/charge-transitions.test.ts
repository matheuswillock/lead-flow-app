import { describe, expect, it } from "bun:test"
import { CHARGE_STATUSES } from "./charge-status"
import { canTransitionCharge } from "./charge-transitions"

describe("canTransitionCharge", () => {
  it("nunca regride uma cobrança que já saiu de PENDING (evento fora de ordem)", () => {
    expect(canTransitionCharge("CONFIRMED", "PENDING")).toBe(false)
    expect(canTransitionCharge("COMPLETED", "PENDING")).toBe(false)
    expect(canTransitionCharge("REFUNDED", "PENDING")).toBe(false)
  })

  it("não regride COMPLETED para CONFIRMED", () => {
    expect(canTransitionCharge("COMPLETED", "CONFIRMED")).toBe(false)
  })

  it("permite o caminho feliz e o pagamento tardio de uma cobrança vencida", () => {
    expect(canTransitionCharge("PENDING", "CONFIRMED")).toBe(true)
    expect(canTransitionCharge("CONFIRMED", "COMPLETED")).toBe(true)
    expect(canTransitionCharge("EXPIRED", "CONFIRMED")).toBe(true)
    expect(canTransitionCharge("COMPLETED", "REFUNDED")).toBe(true)
    expect(canTransitionCharge("CONFIRMED", "REVIEW")).toBe(true)
  })

  it("CONFIRMED só avança para COMPLETED, REFUNDED ou REVIEW (evento atrasado não desfaz o pagamento)", () => {
    for (const late of ["EXPIRED", "CANCELED", "FAILED"] as const) {
      expect(canTransitionCharge("CONFIRMED", late)).toBe(false)
    }
    for (const next of ["COMPLETED", "REFUNDED", "REVIEW"] as const) {
      expect(canTransitionCharge("CONFIRMED", next)).toBe(true)
    }
  })

  it("COMPLETED só vai para REFUNDED ou REVIEW", () => {
    for (const next of CHARGE_STATUSES) {
      expect(canTransitionCharge("COMPLETED", next)).toBe(next === "REFUNDED" || next === "REVIEW")
    }
  })

  it("EXPIRED, CANCELED e FAILED só reabrem por pagamento explícito (CONFIRMED) ou revisão", () => {
    for (const from of ["EXPIRED", "CANCELED", "FAILED"] as const) {
      expect(canTransitionCharge(from, "CONFIRMED")).toBe(true)
      expect(canTransitionCharge(from, "REVIEW")).toBe(true)
      expect(canTransitionCharge(from, "COMPLETED")).toBe(false)
      expect(canTransitionCharge(from, "PENDING")).toBe(false)
    }
    expect(canTransitionCharge("EXPIRED", "CANCELED")).toBe(false)
    expect(canTransitionCharge("FAILED", "EXPIRED")).toBe(false)
  })

  it("REFUNDED é terminal", () => {
    for (const next of CHARGE_STATUSES) {
      expect(canTransitionCharge("REFUNDED", next)).toBe(false)
    }
  })

  it("o mesmo status não é transição", () => {
    for (const status of CHARGE_STATUSES) expect(canTransitionCharge(status, status)).toBe(false)
  })
})
