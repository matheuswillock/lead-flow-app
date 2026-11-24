import { describe, expect, it, mock } from "bun:test"
import { BillingGracePaymentUseCase } from "./BillingGracePaymentUseCase"

describe("BillingGracePaymentUseCase", () => {
  it("devolve a quote calculada pelo service", async () => {
    const service = {
      getQuote: mock(async () => ({
        cycles: [],
        currentCycle: "monthly",
        hasUnlimitedUsers: false,
        expiresAt: "2026-10-20T12:10:00.000Z",
        cardCheckout: null,
      })),
      createPixPayment: mock(async () => ({} as never)),
      createCardPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }

    const output = await new BillingGracePaymentUseCase(service).getQuote("supabase-1")

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ currentCycle: "monthly", cardCheckout: null })
    expect(service.getQuote).toHaveBeenCalledWith("supabase-1")
  })

  it("rejeita criação sem idempotency key", async () => {
    const service = {
      getQuote: mock(async () => ({} as never)),
      createPixPayment: mock(async () => ({} as never)),
      createCardPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }

    const output = await new BillingGracePaymentUseCase(service).createPixPayment({
      supabaseId: "supabase-1",
      idempotencyKey: "",
      cycle: "monthly",
      termsAcceptedAt: "2026-11-23T12:00:00.000Z",
      termsVersion: "2026-08-27",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Idempotency key é obrigatória")
    expect(service.createPixPayment).not.toHaveBeenCalled()
  })

  it("rejeita criação sem prazo escolhido", async () => {
    const service = {
      getQuote: mock(async () => ({} as never)),
      createPixPayment: mock(async () => ({} as never)),
      createCardPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }

    const output = await new BillingGracePaymentUseCase(service).createPixPayment({
      supabaseId: "supabase-1",
      idempotencyKey: "k-1",
      cycle: " ",
      termsAcceptedAt: "2026-11-23T12:00:00.000Z",
      termsVersion: "2026-08-27",
    })

    expect(output.errorMessages).toContain("Escolha o prazo da renovação")
    expect(service.createPixPayment).not.toHaveBeenCalled()
  })

  it("rejeita cartão sem ctok efêmero válido", async () => {
    const service = {
      getQuote: mock(async () => ({} as never)),
      createPixPayment: mock(async () => ({} as never)),
      createCardPayment: mock(async () => ({} as never)),
      getPayment: mock(async () => ({} as never)),
    }
    const output = await new BillingGracePaymentUseCase(service).createCardPayment({
      supabaseId: "sb-1", idempotencyKey: "k", cycle: "monthly", cardToken: "pan-data", installments: 1,
      termsAcceptedAt: "2026-11-23T12:00:00.000Z", termsVersion: "2026-08-27",
    })
    expect(output.isValid).toBe(false)
    expect(service.createCardPayment).not.toHaveBeenCalled()
  })
})
