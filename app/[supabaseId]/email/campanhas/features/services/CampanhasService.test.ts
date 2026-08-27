import { afterEach, describe, expect, it, mock } from "bun:test"
import { isApiRequestError } from "@/lib/http/api-request-error"

/**
 * Regressão Calli (2026-08-27): o backend recusa o disparo (400, Output com
 * errorMessages de produto) e o front jogava fora a origem da mensagem —
 * `throw new Error(json.errorMessages.join(', '))` perde a etiqueta "isto veio
 * da nossa rota", forçando `toUserToastMessage` a adivinhar pela string
 * (acento/marcador). CampanhasService.send precisa propagar ApiRequestError
 * para que o toast preserve a copy de produto sempre, não por sorte de acento.
 */
describe("CampanhasService.send — propagação de erro HTTP", () => {
  afterEach(() => {
    mock.restore()
  })

  it("resposta 400 com Output inválido vira ApiRequestError com a mensagem de produto intacta", async () => {
    const backendMessage =
      "Envio de e-mail liberado apenas para o Grupo Beta de Radar no time ativo"
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [backendMessage], result: null },
        { status: 400 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.send("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(true)
    expect((caught as Error).message).toBe(backendMessage)
    expect((caught as { status?: number }).status).toBe(400)
  })

  it("res.ok mas isValid:false (200 com Output negativo) também vira ApiRequestError", async () => {
    const backendMessage = "Nenhum contato ativo na lista para envio"
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [backendMessage], result: null },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.send("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(true)
    expect((caught as Error).message).toBe(backendMessage)
  })

  it("202 Accepted com isValid:true não lança — sucesso normal", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        {
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: {
            campaignId: "camp-1",
            dispatchId: "dispatch-1",
            totalRecipients: 3,
            status: "sending",
          },
        },
        { status: 202 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    const result = await service.send("supa-1", "team-1", "camp-1")
    expect(result.dispatchId).toBe("dispatch-1")
    expect(result.totalRecipients).toBe(3)
  })

  it("falha de rede real (fetch rejeita) NÃO vira ApiRequestError — continua um erro técnico genuíno", async () => {
    const fetchMock = mock(async () => {
      throw new TypeError("fetch failed")
    })
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.send("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(false)
    expect(caught).toBeInstanceOf(TypeError)
  })
})
