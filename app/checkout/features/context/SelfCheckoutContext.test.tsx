import { afterEach, describe, expect, it } from "bun:test"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { SelfCheckoutError, type SelfCheckoutOptionsDTO, type SelfCheckoutRequest } from "@/lib/self-checkout/contracts"
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
  optionsResult: () => Promise<SelfCheckoutOptionsDTO> = async () => twoCycles
  createResult: (request: SelfCheckoutRequest) => Promise<{ token: string }> = async () => ({ token: "tok-1" })

  async getOptions() {
    this.optionsCalls += 1
    return this.optionsResult()
  }

  async create(request: SelfCheckoutRequest) {
    this.createCalls.push(request)
    return this.createResult(request)
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
    result.current.setFieldValue("fullName", "Maria Souza")
    result.current.setFieldValue("email", "maria@example.com")
    result.current.setFieldValue("phone", "11999998888")
  })
}

describe("SelfCheckoutContext - carga", () => {
  it("carrega os planos uma única vez e pré-seleciona o primeiro", async () => {
    const service = new FakeService()
    const { result } = setup(service)

    expect(result.current.loadStatus).toBe("loading")
    await waitFor(() => expect(result.current.loadStatus).toBe("ready"))

    expect(service.optionsCalls).toBe(1)
    expect(result.current.options).toEqual(twoCycles)
    expect(result.current.selectedCycle).toBe("monthly")
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

    expect(outcome).toEqual({ kind: "invalid", firstInvalidField: "fullName" })
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
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "annual",
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
