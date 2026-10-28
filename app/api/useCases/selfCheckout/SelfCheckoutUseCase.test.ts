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
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999999999",
  cycle: "monthly",
}

const OPTIONS: SelfCheckoutOptionsDTO = {
  product: { name: "CRM", description: null },
  cycles: [{ cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 }],
}

function build(overrides: {
  createSelfCheckout?: () => Promise<{ token: string }>
  getSelfCheckoutOptions?: () => Promise<SelfCheckoutOptionsDTO>
  assertAvailable?: () => Promise<void>
} = {}) {
  const createSelfCheckout = mock(overrides.createSelfCheckout ?? (async () => ({ token: "tok-1" })))
  const getSelfCheckoutOptions = mock(overrides.getSelfCheckoutOptions ?? (async () => OPTIONS))
  const assertAvailable = mock(overrides.assertAvailable ?? (async () => undefined))
  const service = { createSelfCheckout, getSelfCheckoutOptions } as unknown as IBackofficeAdhesionService
  const providerGate: ISelfCheckoutProviderGate = { assertAvailable }
  const useCase = new SelfCheckoutUseCase(service, providerGate)
  return { useCase, createSelfCheckout, getSelfCheckoutOptions, assertAvailable }
}

describe("SelfCheckoutUseCase.create", () => {
  it("cria a adesão e devolve apenas o token", async () => {
    const { useCase, createSelfCheckout } = build()

    const output = await useCase.create(REQUEST)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ token: "tok-1" })
    expect(createSelfCheckout).toHaveBeenCalledWith(REQUEST)
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
