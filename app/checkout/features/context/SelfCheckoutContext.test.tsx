import { afterEach, describe, expect, it } from "bun:test"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { ApiRequestError } from "@/lib/http/api-request-error"
import {
  SelfCheckoutError,
  type SelfCheckoutCouponQuote,
  type SelfCheckoutCouponQuoteRequest,
  type SelfCheckoutOptionsDTO,
  type SelfCheckoutRequest,
} from "@/lib/self-checkout/contracts"
import type { CompanyLookup } from "@/lib/services/CnpjService"
import type { ISelfCheckoutService } from "../services/ISelfCheckoutService"
import { SelfCheckoutProvider } from "./SelfCheckoutContext"
import { useSelfCheckout } from "./SelfCheckoutHook"

afterEach(() => cleanup())

const twoCycles: SelfCheckoutOptionsDTO = {
  product: { name: "Corretor Studio", description: null },
  cycles: [
    { cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 },
    { cycle: "annual", label: "Anual", pixTotal: 960, monthlyEquivalent: 80, months: 12 },
  ],
}

class FakeService implements ISelfCheckoutService {
  optionsCalls = 0
  createCalls: SelfCheckoutRequest[] = []
  couponCalls: SelfCheckoutCouponQuoteRequest[] = []
  couponResult: (request: SelfCheckoutCouponQuoteRequest) => Promise<SelfCheckoutCouponQuote> = async () => ({
    code: "BEMVINDO",
    label: "10% de desconto",
    discountAmount: 96,
    totalAfterDiscount: 864,
  })
  optionsResult: () => Promise<SelfCheckoutOptionsDTO> = async () => twoCycles
  createResult: (request: SelfCheckoutRequest) => Promise<{ token: string }> = async () => ({ token: "tok-1" })

  async getOptions() {
    this.optionsCalls += 1
    return this.optionsResult()
  }

  async quoteCoupon(request: SelfCheckoutCouponQuoteRequest): Promise<SelfCheckoutCouponQuote> {
    this.couponCalls.push(request)
    return this.couponResult(request)
  }

  async create(request: SelfCheckoutRequest) {
    this.createCalls.push(request)
    return this.createResult(request)
  }

  lookupCalls: string[] = []
  lookupResult: (cnpj: string) => Promise<CompanyLookup | null> = async () => null

  async lookupCompany(cnpj: string) {
    this.lookupCalls.push(cnpj)
    return this.lookupResult(cnpj)
  }
}

function setup(service: FakeService) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SelfCheckoutProvider service={service}>{children}</SelfCheckoutProvider>
  )
  return renderHook(() => useSelfCheckout(), { wrapper })
}

function fillValidForm(result: { current: ReturnType<typeof useSelfCheckout> }) {
  act(() => {
    result.current.setFieldValue("companyLegalName", "Corretora Exemplo Ltda")
    result.current.setFieldValue("cnpj", "11222333000181")
    result.current.setFieldValue("fullName", "Maria Souza")
    result.current.setFieldValue("email", "maria@example.com")
    result.current.setFieldValue("phone", "11999998888")
    result.current.setTermsAccepted(true)
  })
}

describe("SelfCheckoutContext - carga", () => {
  it("carrega os planos uma única vez e pré-seleciona o plano anual", async () => {
    const service = new FakeService()
    const { result } = setup(service)

    expect(result.current.loadStatus).toBe("loading")
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    expect(service.optionsCalls).toBe(1)
    expect(result.current.options).toEqual(twoCycles)
    expect(result.current.selectedCycle).toBe("annual")
  })

  it("expõe o erro de carga e permite tentar de novo", async () => {
    const service = new FakeService()
    service.optionsResult = async () => {
      throw new Error("Não foi possível carregar os planos.")
    }
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("error"))
    expect(result.current.loadErrorMessage).toBe("Não foi possível carregar os planos.")

    service.optionsResult = async () => twoCycles
    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.loadStatus).toBe("ready")
    expect(service.optionsCalls).toBe(2)
  })
})

describe("SelfCheckoutContext - envio", () => {
  it("valida antes de chamar o serviço e aponta o primeiro campo inválido", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined
    await act(async () => {
      outcome = await result.current.submit()
    })

    expect(outcome).toEqual({ kind: "invalid", firstInvalidField: "cnpj" })
    expect(service.createCalls).toHaveLength(0)
    expect(result.current.fieldErrors.email).toBeDefined()
  })

  it("envia só ciclo e dados do comprador e devolve o token", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    act(() => result.current.selectCycle("annual"))
    fillValidForm(result)

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined
    await act(async () => {
      outcome = await result.current.submit()
    })

    expect(outcome).toEqual({ kind: "created", token: "tok-1" })
    expect(service.createCalls).toEqual([
      {
        companyLegalName: "Corretora Exemplo Ltda",
        cnpj: "11222333000181",
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "annual",
        termsAccepted: true,
        website: "",
      },
    ])
    expect(result.current.isRedirecting).toBe(true)
    expect(result.current.isSubmitting).toBe(false)
  })

  it("trava o duplo clique: chamadas simultâneas geram um único POST", async () => {
    const service = new FakeService()
    let release: (value: { token: string }) => void = () => undefined
    service.createResult = () => new Promise((resolve) => (release = resolve))
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    const outcomes: string[] = []
    await act(async () => {
      const first = result.current.submit().then((outcome) => outcomes.push(outcome.kind))
      const second = result.current.submit().then((outcome) => outcomes.push(outcome.kind))
      await waitFor(() => expect(outcomes).toContain("ignored"))
      release({ token: "tok-2" })
      await Promise.all([first, second])
    })

    expect(service.createCalls).toHaveLength(1)
    expect(outcomes.sort()).toEqual(["created", "ignored"])
  })

  it("não permite novo envio depois de criada a adesão (aguardando redirecionamento)", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)
    await act(async () => {
      await result.current.submit()
    })

    let outcome: Awaited<ReturnType<typeof result.current.submit>> | undefined
    await act(async () => {
      outcome = await result.current.submit()
    })

    expect(outcome).toEqual({ kind: "ignored" })
    expect(service.createCalls).toHaveLength(1)
  })

  it("libera o envio após falha e mostra a mensagem de conta existente", async () => {
    const service = new FakeService()
    service.createResult = async () => {
      throw new SelfCheckoutError("ACCOUNT_EXISTS", "x")
    }
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    await act(async () => {
      await result.current.submit()
    })

    expect(result.current.submitFailure).toEqual({
      code: "ACCOUNT_EXISTS",
      message: "Já existe uma conta com este e-mail.",
    })
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isRedirecting).toBe(false)

    service.createResult = async () => ({ token: "tok-3" })
    await act(async () => {
      await result.current.submit()
    })
    expect(service.createCalls).toHaveLength(2)
  })

  it("recarrega os planos em silêncio quando o ciclo deixou de existir e troca a seleção", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    act(() => result.current.selectCycle("annual"))
    fillValidForm(result)
    service.createResult = async () => {
      throw new SelfCheckoutError("CYCLE_UNAVAILABLE", "x")
    }
    service.optionsResult = async () => ({ ...twoCycles, cycles: [twoCycles.cycles[0]] })

    await act(async () => {
      await result.current.submit()
    })

    await waitFor(() => expect(result.current.selectedCycle).toBe("monthly"))
    expect(result.current.loadStatus).toBe("ready")
    expect(result.current.submitFailure?.code).toBe("CYCLE_UNAVAILABLE")
    expect(service.optionsCalls).toBe(2)
  })

  it("aplica a máscara de celular ao digitar", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    act(() => result.current.setFieldValue("phone", "11999998888"))

    expect(result.current.values.phone).toBe("(11) 99999-8888")
  })
})

const cardCycles: SelfCheckoutOptionsDTO = {
  product: { name: "Corretor Studio", description: null },
  couponsEnabled: true,
  cycles: [
    { cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 },
    {
      cycle: "annual",
      label: "Anual",
      pixTotal: 960,
      monthlyEquivalent: 80,
      months: 12,
      creditCardTotal: 1080,
      creditCardMonthlyEquivalent: 90,
      maxInstallments: 12,
    },
  ],
}

describe("SelfCheckoutContext - validação ao sair do campo", () => {
  it("campo obrigatório vazio mostra erro depois de visitado, sem precisar enviar", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    expect(result.current.fieldErrors.companyLegalName).toBeUndefined()

    act(() => result.current.markFieldTouched("companyLegalName"))
    act(() => result.current.markFieldTouched("cnpj"))

    expect(result.current.fieldErrors.companyLegalName).toBe("Informe a razão social conforme o CNPJ.")
    expect(result.current.fieldErrors.cnpj).toBe("Informe o CNPJ.")
    // Campos ainda não visitados continuam sem erro.
    expect(result.current.fieldErrors.email).toBeUndefined()
    expect(result.current.fieldErrors.fullName).toBeUndefined()
  })

  it("o erro some assim que o campo fica válido", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    act(() => result.current.markFieldTouched("cnpj"))
    expect(result.current.fieldErrors.cnpj).toBeDefined()

    act(() => result.current.setFieldValue("cnpj", "11222333000181"))
    expect(result.current.fieldErrors.cnpj).toBeUndefined()
  })
})

describe("SelfCheckoutContext - consulta de CNPJ", () => {
  it("preenche razão social e nome fantasia pelo CNPJ válido", async () => {
    const service = new FakeService()
    service.lookupResult = async () => ({ legalName: "CORRETORA EXEMPLO LTDA", tradeName: "Exemplo Seguros" })
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    act(() => result.current.setFieldValue("cnpj", "11222333000181"))
    await waitFor(() => expect(result.current.values.companyLegalName).toBe("CORRETORA EXEMPLO LTDA"))
    expect(result.current.values.companyTradeName).toBe("Exemplo Seguros")
    expect(service.lookupCalls).toEqual(["11222333000181"])
  })

  it("não sobrescreve o que o cliente já digitou e não consulta CNPJ inválido", async () => {
    const service = new FakeService()
    service.lookupResult = async () => ({ legalName: "OUTRO NOME", tradeName: null })
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    act(() => result.current.setFieldValue("cnpj", "11111111111111"))
    expect(service.lookupCalls).toHaveLength(0)

    act(() => result.current.setFieldValue("companyLegalName", "Minha Razão Social"))
    act(() => result.current.setFieldValue("cnpj", "11222333000181"))
    await waitFor(() => expect(service.lookupCalls).toHaveLength(1))
    expect(result.current.values.companyLegalName).toBe("Minha Razão Social")
  })

  it("se a consulta falhar, segue sem preencher", async () => {
    const service = new FakeService()
    service.lookupResult = async () => {
      throw new Error("fora do ar")
    }
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    act(() => result.current.setFieldValue("cnpj", "11222333000181"))
    await waitFor(() => expect(result.current.isLookingUpCompany).toBe(false))
    expect(result.current.values.companyLegalName).toBe("")
  })
})

describe("SelfCheckoutContext - validar e criar pedido", () => {
  it("validate aponta o primeiro campo inválido sem criar pedido", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    const found: Array<string | null> = []
    act(() => {
      found.push(result.current.validate())
    })
    expect(found[0]).toBe("cnpj")
    expect(service.createCalls).toHaveLength(0)
  })

  it("depois de criado o pedido guarda o token para gerar o pagamento", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    await act(async () => {
      await result.current.submit()
    })
    expect(result.current.orderToken).toBe("tok-1")
  })
})

describe("SelfCheckoutContext - adicionais", () => {
  it("limita a quantidade entre 0 e 50 e envia os adicionais no pedido", async () => {
    const service = new FakeService()
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    act(() => result.current.setExtraQuantity("extraUsers", 3))
    act(() => result.current.setExtraQuantity("extraTeams", 999))
    expect(result.current.values.extraUsers).toBe(3)
    expect(result.current.values.extraTeams).toBe(50)
    act(() => result.current.setExtraQuantity("extraTeams", -4))
    expect(result.current.values.extraTeams).toBe(0)

    // Plano anual (padrão): usuários ilimitados, então só o time adicional segue no pedido.
    act(() => result.current.setExtraQuantity("extraTeams", 2))
    await act(async () => {
      await result.current.submit()
    })
    const lastCall = service.createCalls[service.createCalls.length - 1]
    expect(lastCall).toMatchObject({ extraTeams: 2 })
    expect(lastCall).not.toHaveProperty("extraUsers")
  })
})

describe("SelfCheckoutContext - cartão e cupom", () => {
  it("envia a forma de pagamento só quando é cartão e volta para PIX se o plano não aceita cartão", async () => {
    const service = new FakeService()
    service.optionsResult = async () => cardCycles
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    act(() => result.current.setBillingType("CREDIT_CARD"))
    await act(async () => {
      await result.current.submit()
    })
    expect(service.createCalls[0]).toMatchObject({ cycle: "annual", billingType: "CREDIT_CARD" })

    act(() => result.current.selectCycle("monthly"))
    expect(result.current.values.billingType).toBe("PIX")
  })

  it("aplica o cupom no servidor, envia o código no pedido e o remove ao trocar o plano", async () => {
    const service = new FakeService()
    service.optionsResult = async () => cardCycles
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    act(() => result.current.setCouponInput("bemvindo"))
    await act(async () => {
      await result.current.applyCoupon()
    })

    expect(service.couponCalls).toEqual([{ couponCode: "bemvindo", cycle: "annual" }])
    expect(result.current.couponStatus).toBe("applied")
    expect(result.current.couponQuote?.totalAfterDiscount).toBe(864)
    expect(result.current.values.couponCode).toBe("BEMVINDO")

    await act(async () => {
      await result.current.submit()
    })
    expect(service.createCalls[0]).toMatchObject({ couponCode: "BEMVINDO" })

    act(() => result.current.selectCycle("monthly"))
    expect(result.current.couponQuote).toBeNull()
    expect(result.current.values.couponCode).toBe("")
    expect(result.current.couponMessage).toContain("plano mudou")
  })

  it("mostra o motivo quando o servidor recusa o cupom e não envia código no pedido", async () => {
    const service = new FakeService()
    service.optionsResult = async () => cardCycles
    service.couponResult = async () => {
      throw new ApiRequestError("Cupom expirado.", 422)
    }
    const { result } = setup(service)
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))
    fillValidForm(result)

    act(() => result.current.setCouponInput("VELHO"))
    await act(async () => {
      await result.current.applyCoupon()
    })

    expect(result.current.couponStatus).toBe("error")
    expect(result.current.couponMessage).toBe("Cupom expirado.")
    expect(result.current.values.couponCode).toBe("")

    await act(async () => {
      await result.current.submit()
    })
    expect(service.createCalls[0]).not.toHaveProperty("couponCode")
  })
})
