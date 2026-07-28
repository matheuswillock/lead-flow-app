import { describe, expect, it } from "bun:test"
import {
  ADHESION_INSTALLMENT_DUE_INTERVAL_DAYS,
  resolveAdhesionInstallmentDueDate,
} from "./installment-due-date"

describe("resolveAdhesionInstallmentDueDate", () => {
  const createdAt = new Date("2026-07-28T15:00:00.000Z")

  it("parcela 0 vence no dia da criação", () => {
    expect(resolveAdhesionInstallmentDueDate(createdAt, 0, "America/Sao_Paulo")).toBe("2026-07-28")
  })

  it("parcela 1 vence em 30 dias e parcela 2 em 60 dias", () => {
    expect(resolveAdhesionInstallmentDueDate(createdAt, 1, "America/Sao_Paulo")).toBe("2026-08-27")
    expect(resolveAdhesionInstallmentDueDate(createdAt, 2, "America/Sao_Paulo")).toBe("2026-09-26")
  })

  it("usa intervalo de 30 dias", () => {
    expect(ADHESION_INSTALLMENT_DUE_INTERVAL_DAYS).toBe(30)
  })
})
