import { describe, expect, it } from "bun:test"
import { ApiRequestError } from "@/lib/http/api-request-error"
import { SELF_CHECKOUT_ERROR_CODES, SelfCheckoutError } from "@/lib/self-checkout/contracts"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import {
  describeSubmitFailure,
  formatBRL,
  INITIAL_FORM_VALUES,
  pickDefaultCycle,
  resolveSelectedCycle,
  validateSelfCheckoutForm,
} from "./selfCheckoutForm"

const monthly: SelfCheckoutCycleOption = {
  cycle: "monthly",
  label: "Mensal",
  pixTotal: 100,
  monthlyEquivalent: 100,
  months: 1,
}
const annual: SelfCheckoutCycleOption = {
  cycle: "annual",
  label: "Anual",
  pixTotal: 960,
  monthlyEquivalent: 80,
  months: 12,
}

const validValues = {
  ...INITIAL_FORM_VALUES,
  fullName: "  Maria Souza ",
  email: "Maria@Example.com ",
  phone: "(11) 99999-8888",
}

describe("formatBRL", () => {
  it("formata em reais no padrão brasileiro", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50")
  })
})

describe("pickDefaultCycle", () => {
  it("pré-seleciona o primeiro ciclo devolvido pela API", () => {
    expect(pickDefaultCycle([annual, monthly])).toBe("annual")
  })

  it("devolve null quando a lista está vazia", () => {
    expect(pickDefaultCycle([])).toBeNull()
  })
})

describe("resolveSelectedCycle", () => {
  it("mantém a escolha atual se o ciclo ainda existe", () => {
    expect(resolveSelectedCycle([monthly, annual], "annual")).toBe("annual")
  })

  it("cai para o primeiro ciclo quando o escolhido saiu da lista", () => {
    expect(resolveSelectedCycle([monthly], "annual")).toBe("monthly")
  })
})

describe("validateSelfCheckoutForm", () => {
  it("monta o corpo só com ciclo e dados do comprador, sem preço", () => {
    const result = validateSelfCheckoutForm(validValues, "monthly")

    expect(result).toEqual({
      ok: true,
      request: {
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "monthly",
        website: "",
      },
    })
  })

  it("reporta erro por campo e indica o primeiro inválido na ordem visual", () => {
    const result = validateSelfCheckoutForm({ ...INITIAL_FORM_VALUES, email: "nao-e-email" }, "monthly")

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.fullName).toBeDefined()
    expect(result.errors.email).toBe("E-mail inválido.")
    expect(result.errors.phone).toBeDefined()
    expect(result.firstInvalidField).toBe("fullName")
  })

  it("exige um plano selecionado", () => {
    const result = validateSelfCheckoutForm(validValues, null)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.cycle).toBe("Selecione um plano.")
    expect(result.firstInvalidField).toBe("cycle")
  })

  it("repassa o honeypot preenchido para o backend descartar", () => {
    const result = validateSelfCheckoutForm({ ...validValues, website: "spam.example" }, "monthly")

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.request.website).toBe("spam.example")
  })
})

describe("describeSubmitFailure", () => {
  it.each([
    [SELF_CHECKOUT_ERROR_CODES.ACCOUNT_EXISTS, "Já existe uma conta com este e-mail."],
    [SELF_CHECKOUT_ERROR_CODES.RATE_LIMITED, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
    [SELF_CHECKOUT_ERROR_CODES.PROVIDER_UNAVAILABLE, "Pagamento temporariamente indisponível. Tente novamente em instantes."],
    [SELF_CHECKOUT_ERROR_CODES.CYCLE_UNAVAILABLE, "Este plano não está mais disponível. Escolha outro plano."],
  ] as const)("mapeia %s para a mensagem do produto", (code, message) => {
    expect(describeSubmitFailure(new SelfCheckoutError(code, "texto do servidor"))).toEqual({ code, message })
  })

  it("usa a mensagem do servidor em erro de validação conhecido", () => {
    expect(describeSubmitFailure(new ApiRequestError("Celular inválido.", 400))).toEqual({
      code: "UNKNOWN",
      message: "Celular inválido.",
    })
  })

  it("devolve texto genérico para falha de rede ou erro técnico", () => {
    expect(describeSubmitFailure(new TypeError("Failed to fetch"))).toEqual({
      code: "UNKNOWN",
      message: "Não foi possível continuar. Tente novamente.",
    })
  })
})
