import { describe, expect, it } from "bun:test"
import { PAYMENT_ATTEMPT_STATUSES } from "@/lib/payment-provider/types"
import {
  CHARGE_STATUSES,
  chargeStatusFromAsaas,
  chargeStatusFromAttempt,
  isChargeStatus,
} from "./charge-status"

describe("chargeStatusFromAttempt", () => {
  it("cobre todos os status de tentativa com um status do ledger válido", () => {
    for (const status of Object.values(PAYMENT_ATTEMPT_STATUSES)) {
      expect(isChargeStatus(chargeStatusFromAttempt(status))).toBe(true)
    }
  })

  it("trata disputa e resultado indeterminado como revisão, não como reembolso", () => {
    expect(chargeStatusFromAttempt("DISPUTED")).toBe("REVIEW")
    expect(chargeStatusFromAttempt("UNKNOWN")).toBe("REVIEW")
  })

  it("mantém pendente, confirmado e terminais", () => {
    expect(chargeStatusFromAttempt("CREATED")).toBe("PENDING")
    expect(chargeStatusFromAttempt("CONFIRMED")).toBe("CONFIRMED")
    expect(chargeStatusFromAttempt("EXPIRED")).toBe("EXPIRED")
    expect(chargeStatusFromAttempt("REFUNDED")).toBe("REFUNDED")
  })
})

describe("chargeStatusFromAsaas", () => {
  it("mapeia os pagos para CONFIRMED", () => {
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]) {
      expect(chargeStatusFromAsaas(status)).toBe("CONFIRMED")
    }
  })

  it("mapeia pendências, vencimento, estorno, chargeback, cancelamento e recusa", () => {
    expect(chargeStatusFromAsaas("PENDING")).toBe("PENDING")
    expect(chargeStatusFromAsaas("OVERDUE")).toBe("EXPIRED")
    expect(chargeStatusFromAsaas("REFUNDED")).toBe("REFUNDED")
    expect(chargeStatusFromAsaas("CHARGEBACK_REQUESTED")).toBe("REVIEW")
    expect(chargeStatusFromAsaas("CANCELLED")).toBe("CANCELED")
    expect(chargeStatusFromAsaas("REFUSED")).toBe("FAILED")
  })

  it("status ausente ou desconhecido vira REVIEW e nunca pago", () => {
    expect(chargeStatusFromAsaas(undefined)).toBe("REVIEW")
    expect(chargeStatusFromAsaas("STATUS_NOVO_DO_ASAAS")).toBe("REVIEW")
  })

  it("só devolve valores do vocabulário", () => {
    for (const status of ["RECEIVED", "PENDING", "OVERDUE", "X", ""]) {
      expect(CHARGE_STATUSES).toContain(chargeStatusFromAsaas(status))
    }
  })
})
