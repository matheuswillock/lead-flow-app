import { describe, expect, it } from "bun:test"
import { ApiRequestError } from "@/lib/http/api-request-error"
import { SelfCheckoutError, type SelfCheckoutRequest } from "@/lib/self-checkout/contracts"
import { SelfCheckoutService } from "./SelfCheckoutService"

const request: SelfCheckoutRequest = {
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999998888",
  cycle: "quarterly",
  website: "",
}

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body instanceof Error) throw body
        return body
      },
    } as Response
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

const optionsBody = {
  isValid: true,
  errorMessages: [],
  result: {
    product: { name: "Corretor Studio", description: "  " },
    cycles: [
      { cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 },
      { cycle: "invalido", label: "Ruído", pixTotal: 1, monthlyEquivalent: 1, months: 1 },
      { cycle: "annual", label: "Anual", pixTotal: "960", monthlyEquivalent: 80, months: 12 },
    ],
  },
}

describe("SelfCheckoutService.getOptions", () => {
  it("lê o endpoint público sem cache e descarta ciclos malformados", async () => {
    const { fetcher, calls } = fakeFetch(200, optionsBody)

    const options = await new SelfCheckoutService(fetcher).getOptions()

    expect(calls[0].url).toEndWith("/public-self-checkout/options")
    expect(calls[0].url).not.toContain("/api/v1")
    expect(calls[0].init?.cache).toBe("no-store")
    expect(options.product).toEqual({ name: "Corretor Studio", description: null })
    expect(options.cycles.map((option) => option.cycle)).toEqual(["monthly"])
  })

  it("aceita lista vazia (compra online indisponível)", async () => {
    const { fetcher } = fakeFetch(200, {
      isValid: true,
      result: { product: { name: "Corretor Studio", description: "Gestão de leads" }, cycles: [] },
    })

    const options = await new SelfCheckoutService(fetcher).getOptions()

    expect(options.cycles).toEqual([])
    expect(options.product.description).toBe("Gestão de leads")
  })

  it("falha com a mensagem do servidor quando a resposta é inválida", async () => {
    const { fetcher } = fakeFetch(503, { isValid: false, errorMessages: ["Fora do ar."] })

    await expect(new SelfCheckoutService(fetcher).getOptions()).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Fora do ar.",
      status: 503,
    })
  })

  it("falha quando o resultado não tem o formato do contrato", async () => {
    const { fetcher } = fakeFetch(200, { isValid: true, result: { cycles: [] } })

    await expect(new SelfCheckoutService(fetcher).getOptions()).rejects.toBeInstanceOf(ApiRequestError)
  })
})

describe("SelfCheckoutService.create", () => {
  it("envia só os dados do comprador e o ciclo, e devolve o token", async () => {
    const { fetcher, calls } = fakeFetch(200, { isValid: true, result: { token: "tok-123" } })

    const response = await new SelfCheckoutService(fetcher).create(request)

    expect(response).toEqual({ token: "tok-123" })
    expect(calls[0].url).toEndWith("/public-self-checkout")
    expect(calls[0].init?.method).toBe("POST")
    const body = JSON.parse(calls[0].init?.body as string)
    expect(body).toEqual(request)
    expect(Object.keys(body)).not.toContain("price")
    expect(Object.keys(body)).not.toContain("amount")
  })

  it.each([
    [409, "ACCOUNT_EXISTS"],
    [422, "CYCLE_UNAVAILABLE"],
    [429, "RATE_LIMITED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ] as const)("mapeia o status %s para %s", async (status, code) => {
    const { fetcher } = fakeFetch(status, { isValid: false, errorMessages: ["mensagem do servidor"] })

    const error = await new SelfCheckoutService(fetcher).create(request).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(SelfCheckoutError)
    expect((error as SelfCheckoutError).code).toBe(code)
    expect((error as SelfCheckoutError).message).toBe("mensagem do servidor")
  })

  it("trata status desconhecido como erro de API com a mensagem do servidor", async () => {
    const { fetcher } = fakeFetch(400, { isValid: false, errorMessages: ["Celular inválido."] })

    const error = await new SelfCheckoutService(fetcher).create(request).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect((error as ApiRequestError).message).toBe("Celular inválido.")
    expect((error as ApiRequestError).status).toBe(400)
  })

  it("tolera corpo ilegível em erro e usa texto genérico", async () => {
    const { fetcher } = fakeFetch(500, new SyntaxError("Unexpected token <"))

    await expect(new SelfCheckoutService(fetcher).create(request)).rejects.toMatchObject({
      message: "Não foi possível continuar. Tente novamente.",
      status: 500,
    })
  })

  it("rejeita sucesso sem token", async () => {
    const { fetcher } = fakeFetch(200, { isValid: true, result: {} })

    await expect(new SelfCheckoutService(fetcher).create(request)).rejects.toBeInstanceOf(ApiRequestError)
  })
})
