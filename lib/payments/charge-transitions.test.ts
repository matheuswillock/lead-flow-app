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

  it("REFUNDED é terminal", () => {
    for (const next of CHARGE_STATUSES) {
      expect(canTransitionCharge("REFUNDED", next)).toBe(false)
    }
  })

  it("o mesmo status não é transição", () => {
    for (const status of CHARGE_STATUSES) expect(canTransitionCharge(status, status)).toBe(false)
  })
})
