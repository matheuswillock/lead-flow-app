import { describe, expect, it, mock } from "bun:test"
import { BillingGracePaymentUseCase } from "./BillingGracePaymentUseCase"

describe("BillingGracePaymentUseCase", () => {
  it("devolve a quote calculada pelo service", async () => {
    const service = {
      getQuote: mock(async () => ({
        cycle: "one-time",
        amountCents: 5990,
        expiresAt: "2026-10-20T12:10:00.000Z",
        method: "PIX" as const,
      })),
      createPixPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }

    const output = await new BillingGracePaymentUseCase(service).getQuote("supabase-1")

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ amountCents: 5990, method: "PIX" })
    expect(service.getQuote).toHaveBeenCalledWith("supabase-1")
  })

  it("rejeita criação sem idempotency key", async () => {
    const service = {
      getQuote: mock(async () => ({} as never)),
      createPixPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }

    const output = await new BillingGracePaymentUseCase(service).createPixPayment({
      supabaseId: "supabase-1",
      idempotencyKey: "",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Idempotency key é obrigatória")
    expect(service.createPixPayment).not.toHaveBeenCalled()
  })
})
