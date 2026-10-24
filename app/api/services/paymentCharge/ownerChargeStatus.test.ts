import { describe, expect, it } from "bun:test"
import { adhesionPaymentChargeStatus, gracePaymentChargeStatus, purchaseChargeStatus } from "./ownerChargeStatus"

describe("status dos donos neutros no vocabulário do ledger", () => {
  it("adesão", () => {
    expect(adhesionPaymentChargeStatus("pending")).toBe("PENDING")
    expect(adhesionPaymentChargeStatus("confirmed")).toBe("CONFIRMED")
    expect(adhesionPaymentChargeStatus("completed")).toBe("COMPLETED")
    expect(adhesionPaymentChargeStatus("review")).toBe("REVIEW")
    expect(adhesionPaymentChargeStatus("failed")).toBe("FAILED")
    expect(adhesionPaymentChargeStatus("superseded")).toBe("CANCELED")
    expect(adhesionPaymentChargeStatus("desconhecido")).toBe("REVIEW")
  })

  it("regularização", () => {
    expect(gracePaymentChargeStatus("pending")).toBe("PENDING")
    expect(gracePaymentChargeStatus("confirmed")).toBe("CONFIRMED")
    expect(gracePaymentChargeStatus("completed")).toBe("COMPLETED")
    expect(gracePaymentChargeStatus("qualquer")).toBe("REVIEW")
  })

  it("compra de plataforma", () => {
    expect(purchaseChargeStatus("paid")).toBe("COMPLETED")
    expect(purchaseChargeStatus("pending")).toBe("PENDING")
    expect(purchaseChargeStatus("awaiting_payment")).toBe("PENDING")
    expect(purchaseChargeStatus("failed")).toBe("FAILED")
    expect(purchaseChargeStatus("canceled")).toBe("CANCELED")
    expect(purchaseChargeStatus("outro")).toBe("REVIEW")
  })
})
