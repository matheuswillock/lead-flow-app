import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { AddOnCheckoutContext, AddOnCheckoutProvider } from "./AddOnCheckoutContext"
import { useContext } from "react"
import { ApiRequestError } from "@/lib/http/api-request-error"
import { addOnCheckoutService } from "../services/AddOnCheckoutService"
import { mapPlatformPurchaseToCheckoutData } from "../utils/mapPlatformPurchaseToCheckoutData"
import type { AddOnCheckoutSubmitInput } from "./AddOnCheckoutTypes"

const service = addOnCheckoutService as unknown as Record<string, unknown>
const original = { ...service }

const platformData = mapPlatformPurchaseToCheckoutData({
  checkoutId: "p1",
  purchaseId: "p1",
  productSlug: "email-credits-plus",
  purchaseType: "email_credits",
  status: "pending",
  billingType: "PIX",
  amount: 100,
  quantity: 5000,
  description: null,
  teamId: null,
})

const input = { billingType: "PIX", fullName: "Maria" } as AddOnCheckoutSubmitInput

const pixPayment = {
  amount: 100,
  invoiceUrl: null,
  pix: { payload: "000201", encodedImage: "data:image/png;base64,AAAA", expirationDate: "2999-01-01T00:00:00.000Z" },
}

let calls: string[]

beforeEach(() => {
  calls = []
  service.fetchCheckoutData = async () => platformData
  service.createPlatformPixPayment = async () => {
    calls.push("createPlatformPixPayment")
    return pixPayment
  }
  service.createPayment = async () => {
    calls.push("createPayment")
    return {}
  }
  service.checkPaymentStatus = async () => {
    calls.push("checkPaymentStatus")
    throw new Error("polling legado não deve ser usado")
  }
})

afterEach(() => {
  cleanup()
  Object.assign(service, original)
})

function renderContext() {
  const wrapper = ({ children }: { children: ReactNode }) => <AddOnCheckoutProvider>{children}</AddOnCheckoutProvider>
  return renderHook(() => useContext(AddOnCheckoutContext)!, { wrapper })
}

describe("AddOnCheckoutContext - compra de plataforma via PIX", () => {
  it("gera o PIX pelo endpoint genérico e mapeia para paymentData", async () => {
    const { result } = renderContext()
    await act(async () => {
      await result.current.fetchCheckoutData("p1")
    })

    await act(async () => {
      await result.current.submitPayment(input)
    })

    expect(calls).toEqual(["createPlatformPixPayment"])
    expect(result.current.state.paymentData).toEqual(pixPayment)
    expect(result.current.state.step).toBe("payment")
    expect(result.current.state.isProcessing).toBe(false)
  })

  it("não inicia o polling legado de status", async () => {
    const { result } = renderContext()
    await act(async () => {
      await result.current.fetchCheckoutData("p1")
    })
    await act(async () => {
      await result.current.submitPayment(input)
    })
    await new Promise((resolve) => setTimeout(resolve, 4300))

    expect(calls).not.toContain("checkPaymentStatus")
  })

  it("propaga erro de geração e libera o processamento", async () => {
    service.createPlatformPixPayment = async () => {
      throw new ApiRequestError("Dados do cliente incompletos", 400)
    }
    const { result } = renderContext()
    await act(async () => {
      await result.current.fetchCheckoutData("p1")
    })

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.submitPayment(input)
      } catch (error) {
        thrown = error
      }
    })

    expect((thrown as Error).message).toBe("Dados do cliente incompletos")
    expect(result.current.state.isProcessing).toBe(false)
  })

  it("vira sucesso quando a reconsulta da compra retorna paga", async () => {
    const { result } = renderContext()
    await act(async () => {
      await result.current.fetchCheckoutData("p1")
    })
    service.fetchCheckoutData = async () => ({ ...platformData, alreadyPaid: true, status: "applied" })

    await act(async () => {
      await result.current.refreshPaymentStatus()
    })

    expect(result.current.state.step).toBe("success")
  })
})
