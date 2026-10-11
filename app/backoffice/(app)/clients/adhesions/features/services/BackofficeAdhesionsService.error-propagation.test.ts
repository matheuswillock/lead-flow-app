import { afterEach, describe, expect, it, mock } from "bun:test"
import { isApiRequestError } from "@/lib/http/api-request-error"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

/**
 * `toUserToastMessage` só devolve a mensagem intacta quando `isApiRequestError(error)`
 * é true. Enquanto `BackofficeAdhesionsRequestError` estendia `Error` puro, a mensagem
 * caía na heurística de acento/marcador de `PRODUCT_PORTUGUESE_MARKERS` — e toda copy
 * legítima sem acento e sem palavra-marcador virava "Ocorreu um erro.".
 *
 * As mensagens abaixo foram medidas, não presumidas: varrendo as 56 mensagens que as
 * rotas de `app/api/v1/backoffice/adhesions/**` + `BackofficeAdhesionUseCase` +
 * `BackofficeAdhesionService` podem devolver em `errorMessages[0]`, exatamente estas
 * três eram engolidas pela heurística. Mesma classe de regressão já corrigida em
 * `CampanhasService` (PR #1085) e no módulo de cobranças (PR #1200).
 */
const SWALLOWED_WITHOUT_API_REQUEST_ERROR = [
  // 403 de getBackofficeAccess — atinge TODOS os métodos do service.
  { message: "Acesso negado", status: 403 },
  // 500 catch-all das rotas — também atinge todos os métodos.
  { message: "Erro interno", status: 500 },
  // Validação de normalizeCommercialInput, propagada por getErrorMessage no create.
  { message: "Nome completo deve ter pelo menos 2 caracteres", status: 400 },
] as const

function mockOutputResponse(message: string, status: number): void {
  const fetchMock = mock(async () =>
    Response.json(
      { isValid: false, successMessages: [], errorMessages: [message], result: null },
      { status }
    )
  )
  ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
}

async function captureCreateError(): Promise<unknown> {
  const { BackofficeAdhesionsService } = await import("./BackofficeAdhesionsService")
  const service = new BackofficeAdhesionsService()
  try {
    await service.create({
      leadId: "lead-1",
      fullName: "A",
    } as unknown as Parameters<typeof service.create>[0])
  } catch (error) {
    return error
  }
  return null
}

describe("BackofficeAdhesionsService — propagação de mensagem de erro até o toast", () => {
  afterEach(() => {
    mock.restore()
  })

  for (const { message, status } of SWALLOWED_WITHOUT_API_REQUEST_ERROR) {
    it(`"${message}" (${status}) chega ao toast intacta`, async () => {
      mockOutputResponse(message, status)

      const caught = await captureCreateError()

      expect(isApiRequestError(caught)).toBe(true)
      expect((caught as Error).message).toBe(message)
      expect(toUserToastMessage(caught)).toBe(message)
    })
  }

  it("preserva status e isValidationError para o consumidor do dialog", async () => {
    mockOutputResponse("Acesso negado", 403)

    const caught = await captureCreateError()

    const { BackofficeAdhesionsRequestError } = await import("./BackofficeAdhesionsService")
    expect(caught).toBeInstanceOf(BackofficeAdhesionsRequestError)
    expect((caught as InstanceType<typeof BackofficeAdhesionsRequestError>).status).toBe(403)
    expect(
      (caught as InstanceType<typeof BackofficeAdhesionsRequestError>).isValidationError
    ).toBe(true)
  })

  it("500 não é classificado como erro de validação", async () => {
    mockOutputResponse("Erro interno", 500)

    const caught = await captureCreateError()

    const { BackofficeAdhesionsRequestError } = await import("./BackofficeAdhesionsService")
    expect(
      (caught as InstanceType<typeof BackofficeAdhesionsRequestError>).isValidationError
    ).toBe(false)
  })
})
