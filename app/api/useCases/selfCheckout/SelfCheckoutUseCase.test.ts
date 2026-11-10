import { describe, expect, it, mock } from "bun:test"
import type { IBackofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import {
  SelfCheckoutError,
  type SelfCheckoutOptionsDTO,
  type SelfCheckoutRequest,
} from "@/lib/self-checkout/contracts"
import { SelfCheckoutUseCase } from "./SelfCheckoutUseCase"
import type { ISelfCheckoutProviderGate } from "./ISelfCheckoutUseCase"

const REQUEST: SelfCheckoutRequest = {
  companyLegalName: "Corretora Exemplo Ltda",
  cnpj: "11222333000181",
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999999999",
  cycle: "monthly",
  termsAccepted: true,
}

const OPTIONS: SelfCheckoutOptionsDTO = {
  product: { name: "CRM", description: null },
  cycles: [{ cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 }],
}

function build(overrides: {
  createSelfCheckout?: () => Promise<{ token: string }>
  getSelfCheckoutOptions?: () => Promise<SelfCheckoutOptionsDTO>
  quoteSelfCheckoutCoupon?: () => Promise<unknown>
  assertAvailable?: () => Promise<void>
} = {}) {
  const createSelfCheckout = mock(overrides.createSelfCheckout ?? (async () => ({ token: "tok-1" })))
  const getSelfCheckoutOptions = mock(overrides.getSelfCheckoutOptions ?? (async () => OPTIONS))
  const assertAvailable = mock(overrides.assertAvailable ?? (async () => undefined))
  const quoteSelfCheckoutCoupon = mock(
    overrides.quoteSelfCheckoutCoupon ??
      (async () => ({ code: "BEMVINDO10", label: "10% de desconto", discountAmount: 10, totalAfterDiscount: 90 })),
  )
  const service = {
    createSelfCheckout,
    getSelfCheckoutOptions,
    quoteSelfCheckoutCoupon,
  } as unknown as IBackofficeAdhesionService
  const providerGate: ISelfCheckoutProviderGate = { assertAvailable }
  const useCase = new SelfCheckoutUseCase(service, providerGate)
  return { useCase, createSelfCheckout, getSelfCheckoutOptions, quoteSelfCheckoutCoupon, assertAvailable }
}

describe("SelfCheckoutUseCase.create", () => {
  it("cria a adesão e devolve apenas o token", async () => {
    const { useCase, createSelfCheckout } = build()

    const output = await useCase.create(REQUEST)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ token: "tok-1" })
    expect(createSelfCheckout).toHaveBeenCalledWith(REQUEST)
  })

  it("cartão não passa pelo gate do PIX (o Abacate pode estar fora e o cartão segue pelo Asaas)", async () => {
    const { useCase, createSelfCheckout, assertAvailable } = build({
      assertAvailable: async () => {
        throw new SelfCheckoutError("PROVIDER_UNAVAILABLE", "indisponível")
      },
    })

    const output = await useCase.create({ ...REQUEST, billingType: "CREDIT_CARD" })

    expect(output.isValid).toBe(true)
    expect(assertAvailable).not.toHaveBeenCalled()
    expect(createSelfCheckout).toHaveBeenCalledTimes(1)
  })

  it("provider inapto: PROVIDER_UNAVAILABLE e nada é criado", async () => {
    const { useCase, createSelfCheckout } = build({
      assertAvailable: async () => {
        throw new SelfCheckoutError("PROVIDER_UNAVAILABLE", "indisponível")
      },
    })

    const output = await useCase.create(REQUEST)

    expect(output.isValid).toBe(false)
    expect(output.result).toEqual({ code: "PROVIDER_UNAVAILABLE" })
    expect(createSelfCheckout).not.toHaveBeenCalled()
  })

  it.each([
    ["ACCOUNT_EXISTS", "Já existe uma conta cadastrada com este e-mail."],
    ["CYCLE_UNAVAILABLE", "Plano indisponível."],
  ] as const)("traduz %s em Output inválido com o código e a mensagem", async (code, message) => {
    const { useCase } = build({
      createSelfCheckout: async () => {
        throw new SelfCheckoutError(code, message)
      },
    })

    const output = await useCase.create(REQUEST)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([message])
    expect(output.result).toEqual({ code })
  })

  it("erro inesperado vira mensagem genérica, sem vazar a causa nem o e-mail", async () => {
    const consoleError = mock(() => undefined)
    const original = console.error
    console.error = consoleError
    try {
      const { useCase } = build({
        createSelfCheckout: async () => {
          throw new Error("duplicate key maria@example.com")
        },
      })

      const output = await useCase.create(REQUEST)

      expect(output.isValid).toBe(false)
      expect(output.result).toBeNull()
      expect(JSON.stringify(output)).not.toContain("maria@example.com")
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain("maria@example.com")
    } finally {
      console.error = original
    }
  })
})

describe("SelfCheckoutUseCase.getOptions", () => {
  it("devolve o DTO de opções", async () => {
    const { useCase } = build()

    const output = await useCase.getOptions()

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual(OPTIONS)
  })

  it("falha do serviço vira Output inválido genérico", async () => {
    const original = console.error
    console.error = () => undefined
    try {
      const { useCase } = build({
        getSelfCheckoutOptions: async () => {
          throw new Error("db down")
        },
      })

      const output = await useCase.getOptions()

      expect(output.isValid).toBe(false)
      expect(output.result).toBeNull()
    } finally {
      console.error = original
    }
  })
})

describe("SelfCheckoutUseCase.quoteCoupon", () => {
  const INPUT = { couponCode: "bemvindo10", cycle: "monthly" as const }

  it("devolve a simulação do cupom", async () => {
    const { useCase, quoteSelfCheckoutCoupon } = build()

    const output = await useCase.quoteCoupon(INPUT)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ code: "BEMVINDO10", label: "10% de desconto", discountAmount: 10, totalAfterDiscount: 90 })
    expect(quoteSelfCheckoutCoupon).toHaveBeenCalledWith(INPUT)
  })

  it("cupom recusado vira Output inválido com o código COUPON_INVALID e a mensagem curta", async () => {
    const { useCase } = build({
      quoteSelfCheckoutCoupon: async () => {
        throw new SelfCheckoutError("COUPON_INVALID", "Cupom expirado.")
      },
    })

    const output = await useCase.quoteCoupon(INPUT)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Cupom expirado."])
    expect(output.result).toEqual({ code: "COUPON_INVALID" })
  })

  it("erro inesperado vira mensagem genérica", async () => {
    const original = console.error
    console.error = () => undefined
    try {
      const { useCase } = build({
        quoteSelfCheckoutCoupon: async () => {
          throw new Error("db down")
        },
      })

      const output = await useCase.quoteCoupon(INPUT)

      expect(output.isValid).toBe(false)
      expect(output.result).toBeNull()
    } finally {
      console.error = original
    }
  })
})
