import { describe, expect, it } from "bun:test"
import { BackofficeAdhesionUseCase } from "./BackofficeAdhesionUseCase"
import type { IBackofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"

const INPUT = {
  cardToken: "ctok_abc",
  installments: 3,
  payer: { fullName: "Maria Souza", email: "maria@example.com", phone: "11999999999", cpfCnpj: "11222333000181" },
}

function build(createCardCheckout: () => Promise<unknown>) {
  return new BackofficeAdhesionUseCase({ createCardCheckout } as unknown as IBackofficeAdhesionService)
}

describe("BackofficeAdhesionUseCase.createCardCheckout", () => {
  it("sucesso devolve o pagamento no Output", async () => {
    const useCase = build(async () => ({ adhesionId: "a1", billingType: "CREDIT_CARD", status: "pending" }))

    const output = await useCase.createCardCheckout("tok", INPUT, "idem-1")

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ billingType: "CREDIT_CARD" })
  })

  it("exige a chave de idempotência", async () => {
    const output = await build(async () => ({})).createCardCheckout("tok", INPUT, "  ")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Idempotency key é obrigatória"])
  })

  it("recusa do cartão chega ao cliente com a mensagem genérica", async () => {
    const useCase = build(async () => {
      throw new Error("Não foi possível processar o pagamento com este cartão.")
    })
    const original = console.error
    console.error = () => undefined
    try {
      const output = await useCase.createCardCheckout("tok", INPUT, "idem-2")
      expect(output.isValid).toBe(false)
      expect(output.errorMessages).toEqual(["Não foi possível processar o pagamento com este cartão."])
    } finally {
      console.error = original
    }
  })

  it("erro desconhecido (detalhe do provider, Prisma) nunca vaza: vira a recusa genérica", async () => {
    const useCase = build(async () => {
      throw new Error("AbacatePay 400: card number 4111111111111111 declined by issuer")
    })
    const original = console.error
    console.error = () => undefined
    try {
      const output = await useCase.createCardCheckout("tok", INPUT, "idem-3")
      expect(output.errorMessages).toEqual(["Não foi possível processar o pagamento com este cartão."])
      expect(JSON.stringify(output)).not.toContain("4111")
    } finally {
      console.error = original
    }
  })
})
