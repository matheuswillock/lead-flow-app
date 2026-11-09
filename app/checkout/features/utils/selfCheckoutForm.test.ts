import { describe, expect, it } from "bun:test"
import { ApiRequestError } from "@/lib/http/api-request-error"
import { SELF_CHECKOUT_ERROR_CODES, SelfCheckoutError } from "@/lib/self-checkout/contracts"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import {
  computeOrderAmounts,
  describeSubmitFailure,
  formatBRL,
  withoutDashes,
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
  companyLegalName: "  Corretora Exemplo Ltda ",
  cnpj: "11.222.333/0001-81",
  fullName: "  Maria Souza ",
  email: "Maria@Example.com ",
  phone: "(11) 99999-8888",
  termsAccepted: true,
}

describe("formatBRL", () => {
  it("formata em reais no padrão brasileiro", () => {
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50")
  })
})

describe("computeOrderAmounts", () => {
  const withCard: SelfCheckoutCycleOption = {
    cycle: "semiannual",
    label: "Semestral",
    pixTotal: 958.8,
    monthlyEquivalent: 79.9,
    months: 12,
    creditCardTotal: 1161.12,
    creditCardMonthlyEquivalent: 96.76,
    maxInstallments: 12,
    extraUserMonthlyPrice: 19.9,
    extraTeamMonthlyPrice: 29.9,
  }

  it("sem adicionais, devolve o total do plano na forma escolhida", () => {
    const none = { extraUsers: 0, extraTeams: 0 }
    expect(computeOrderAmounts(withCard, "PIX", none).total).toBe(958.8)
    expect(computeOrderAmounts(withCard, "CREDIT_CARD", none).total).toBe(1161.12)
  })

  it("soma os adicionais ao plano, igual no PIX e no cartão; usuário cobra o valor mensal vezes os meses", () => {
    const extras = { extraUsers: 2, extraTeams: 1 }
    const pix = computeOrderAmounts(withCard, "PIX", extras)
    // 2 usuários x R$ 19,90 x 12 meses
    expect(pix.extraUsersTotal).toBe(477.6)
    expect(pix.extraTeamsTotal).toBe(29.9)
    expect(pix.extrasTotal).toBe(507.5)
    expect(pix.total).toBe(1466.3)

    const card = computeOrderAmounts(withCard, "CREDIT_CARD", extras)
    expect(card.total).toBe(1668.62)
  })

  it("usuário adicional no trimestral: R$ 19,90 x 3 meses por usuário", () => {
    const quarterly = { ...withCard, cycle: "quarterly" as const, label: "Trimestral", months: 3, pixTotal: 269.7, monthlyEquivalent: 89.9 }
    const result = computeOrderAmounts(quarterly, "PIX", { extraUsers: 2, extraTeams: 0 })
    expect(result.extraUsersTotal).toBe(119.4)
    expect(result.total).toBe(389.1)
  })

  it("no plano anual os usuários são ilimitados: não cobra usuário adicional, só time", () => {
    const annualOption = { ...withCard, cycle: "annual" as const, label: "Anual" }
    const result = computeOrderAmounts(annualOption, "PIX", { extraUsers: 5, extraTeams: 1 })
    expect(result.extraUsersTotal).toBe(0)
    expect(result.extrasTotal).toBe(29.9)
    expect(result.total).toBe(988.7)
  })

  it("ignora cartão quando o ciclo não oferece e quantidades negativas", () => {
    const result = computeOrderAmounts(monthly, "CREDIT_CARD", { extraUsers: -3, extraTeams: 0 })
    expect(result.isCard).toBe(false)
    expect(result.total).toBe(100)
  })
})

describe("validateSelfCheckoutForm com adicionais", () => {
  it("envia as quantidades só quando maiores que zero", () => {
    const withExtras = validateSelfCheckoutForm({ ...validValues, extraUsers: 3 }, "semiannual")
    expect(withExtras.ok).toBe(true)
    if (withExtras.ok) {
      expect(withExtras.request.extraUsers).toBe(3)
      expect(withExtras.request.extraTeams).toBeUndefined()
    }
    const annualPlan = validateSelfCheckoutForm({ ...validValues, extraUsers: 3 }, "annual")
    if (annualPlan.ok) expect(annualPlan.request.extraUsers).toBeUndefined()
    const without = validateSelfCheckoutForm(validValues, "annual")
    if (without.ok) {
      expect(without.request.extraUsers).toBeUndefined()
    }
  })
})

describe("withoutDashes", () => {
  it("troca o travessão do cadastro do produto por vírgula", () => {
    expect(withoutDashes("Plano CRM — acesso ao módulo de gestão de leads.")).toBe(
      "Plano CRM, acesso ao módulo de gestão de leads.",
    )
    expect(withoutDashes("Plano A – anual")).toBe("Plano A, anual")
  })

  it("não altera textos sem travessão nem hífens comuns", () => {
    expect(withoutDashes("Corretor Studio e-mail")).toBe("Corretor Studio e-mail")
    expect(withoutDashes("pré-pago")).toBe("pré-pago")
  })
})

describe("pickDefaultCycle", () => {
  it("pré-seleciona o plano anual, mesmo quando ele não é o primeiro da lista", () => {
    expect(pickDefaultCycle([monthly, annual])).toBe("annual")
    expect(pickDefaultCycle([annual, monthly])).toBe("annual")
  })

  it("sem plano anual, usa o primeiro ciclo devolvido pela API", () => {
    expect(pickDefaultCycle([monthly])).toBe("monthly")
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
        companyLegalName: "Corretora Exemplo Ltda",
        cnpj: "11222333000181",
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "monthly",
        termsAccepted: true,
        website: "",
      },
    })
  })

  it("bloqueia o envio sem a declaração de leitura e concordância", () => {
    const result = validateSelfCheckoutForm({ ...validValues, termsAccepted: false }, "monthly")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.firstInvalidField).toBe("termsAccepted")
      expect(result.errors.termsAccepted).toBeTruthy()
    }
  })

  it("reporta erro por campo e indica o primeiro inválido na ordem visual", () => {
    const result = validateSelfCheckoutForm({ ...INITIAL_FORM_VALUES, email: "nao-e-email" }, "monthly")

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.companyLegalName).toBeDefined()
    expect(result.errors.cnpj).toBe("Informe o CNPJ.")
    expect(result.errors.fullName).toBeDefined()
    expect(result.errors.email).toBe("E-mail inválido.")
    expect(result.errors.phone).toBe("WhatsApp inválido.")
    // O CNPJ vem primeiro no formulário, então é o primeiro campo a receber o foco.
    expect(result.firstInvalidField).toBe("cnpj")
  })

  it("só o nome fantasia é opcional: o resto é obrigatório", () => {
    const result = validateSelfCheckoutForm({ ...validValues, companyTradeName: "" }, "monthly")
    expect(result.ok).toBe(true)

    for (const field of ["companyLegalName", "cnpj", "fullName", "email", "phone"] as const) {
      const missing = validateSelfCheckoutForm({ ...validValues, [field]: "" }, "monthly")
      expect(missing.ok).toBe(false)
      if (!missing.ok) expect(missing.firstInvalidField).toBe(field)
    }
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
    expect(describeSubmitFailure(new ApiRequestError("WhatsApp inválido.", 400))).toEqual({
      code: "UNKNOWN",
      message: "WhatsApp inválido.",
    })
  })

  it("devolve texto genérico para falha de rede ou erro técnico", () => {
    expect(describeSubmitFailure(new TypeError("Failed to fetch"))).toEqual({
      code: "UNKNOWN",
      message: "Não foi possível continuar. Tente novamente.",
    })
  })
})
