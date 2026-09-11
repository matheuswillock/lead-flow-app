import { afterEach, describe, expect, it, mock } from "bun:test"
import { isApiRequestError } from "@/lib/http/api-request-error"
import { toUserToastMessage, USER_TOAST_GENERIC_ERROR } from "@/lib/ui/to-user-toast-message"

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

/**
 * Ajuste de review (PR #1085): `parseCampaignsResponse` etiquetava como
 * `ApiRequestError` inclusive os fallbacks técnicos (`HTTP ${status}`, `'Erro'`)
 * quando o corpo não tinha copy de produto — um 502/504 de proxy/CDN (corpo
 * não-JSON) ou um `isValid:false` sem `errorMessages` passava a chegar CRU no
 * toast em vez de mascarado. A etiqueta só pode vir de
 * `Output.errorMessages` real (array não-vazio de strings não-vazias).
 */
describe("CampanhasService — fallback técnico não pode ganhar etiqueta de copy de produto (ajuste de review, PR #1085)", () => {
  afterEach(() => {
    mock.restore()
  })

  it("502 com corpo não-JSON (proxy/CDN) — erro NÃO é ApiRequestError e o toast mostra o genérico", async () => {
    const fetchMock = mock(async () => new Response("<html>Bad Gateway</html>", { status: 502 }))
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.send("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
    expect(isApiRequestError(caught)).toBe(false)
    expect(toUserToastMessage(caught)).toBe(USER_TOAST_GENERIC_ERROR)
  })

  it("200 com isValid:false e errorMessages vazio — erro NÃO é ApiRequestError, mesmo tratamento mascarado", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [], result: null },
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

    expect(isApiRequestError(caught)).toBe(false)
    expect(toUserToastMessage(caught)).toBe(USER_TOAST_GENERIC_ERROR)
  })

  it("errorMessages com copy de produto continua ApiRequestError e passa intacta (não pode quebrar a regressão principal)", async () => {
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
    expect(toUserToastMessage(caught)).toBe(backendMessage)
  })

  it("deleteDraft: 504 (gateway timeout, corpo não-JSON) também não vira ApiRequestError", async () => {
    const fetchMock = mock(async () => new Response("Gateway Timeout", { status: 504 }))
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.deleteDraft("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
    expect(isApiRequestError(caught)).toBe(false)
    expect(toUserToastMessage(caught)).toBe(USER_TOAST_GENERIC_ERROR)
  })

  it("deleteDraft: errorMessages com copy de produto continua ApiRequestError e passa intacta", async () => {
    const backendMessage = "Campanha não pode ser excluída após o primeiro disparo"
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [backendMessage], result: null },
        { status: 409 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { CampanhasService } = await import("./CampanhasService")
    const service = new CampanhasService()

    let caught: unknown = null
    try {
      await service.deleteDraft("supa-1", "team-1", "camp-1")
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(true)
    expect(toUserToastMessage(caught)).toBe(backendMessage)
  })
})
