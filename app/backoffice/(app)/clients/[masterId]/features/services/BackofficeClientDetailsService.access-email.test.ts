import { afterEach, describe, expect, it, mock } from "bun:test"
import { isApiRequestError } from "@/lib/http/api-request-error"

/**
 * Bug reenvio de convite (2026-08-27): `sendAccessEmail` lançava `Error` genérico em
 * falha, perdendo a etiqueta de "veio da nossa rota" — a mesma classe de regressão já
 * corrigida em `CampanhasService` (PR #1085). Sem `ApiRequestError`, uma mensagem sem
 * acento (ex.: o mapeamento de 409 "Reenvio duplicado — aguarde alguns segundos e
 * tente novamente.") teria acento e passaria por sorte — mas não dá pra depender disso.
 */
describe("BackofficeClientDetailsService.sendAccessEmail — propagação de erro HTTP", () => {
  afterEach(() => {
    mock.restore()
  })

  it("Output inválido vira ApiRequestError com a mensagem de produto intacta", async () => {
    const backendMessage = "Reenvio duplicado — aguarde alguns segundos e tente novamente."
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [backendMessage], result: null },
        { status: 400 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeClientDetailsService } = await import("./BackofficeClientDetailsService")
    const service = new BackofficeClientDetailsService()

    let caught: unknown = null
    try {
      await service.sendAccessEmail({
        memberId: "member-1",
        accountMasterId: "master-1",
        mode: "invite",
      })
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(true)
    expect((caught as Error).message).toBe(backendMessage)
  })

  it("sucesso devolve o email normalmente", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: true, successMessages: [], errorMessages: [], result: { email: "ana@example.com" } },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeClientDetailsService } = await import("./BackofficeClientDetailsService")
    const service = new BackofficeClientDetailsService()

    const result = await service.sendAccessEmail({
      memberId: "member-1",
      accountMasterId: "master-1",
      mode: "invite",
    })
    expect(result.email).toBe("ana@example.com")
  })
})

describe("BackofficeClientDetailsService.generateInviteLink (Entregável 3)", () => {
  afterEach(() => {
    mock.restore()
  })

  it("sucesso devolve actionLink", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        {
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: { actionLink: "https://app.local/set-password?token=NEW", email: "ana@example.com" },
        },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeClientDetailsService } = await import("./BackofficeClientDetailsService")
    const service = new BackofficeClientDetailsService()

    const result = await service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })
    expect(result.actionLink).toBe("https://app.local/set-password?token=NEW")
  })

  it("falha vira ApiRequestError com a mensagem de produto intacta", async () => {
    const backendMessage = "Membro não encontrado"
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: [backendMessage], result: null },
        { status: 404 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeClientDetailsService } = await import("./BackofficeClientDetailsService")
    const service = new BackofficeClientDetailsService()

    let caught: unknown = null
    try {
      await service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })
    } catch (err) {
      caught = err
    }

    expect(isApiRequestError(caught)).toBe(true)
    expect((caught as Error).message).toBe(backendMessage)
  })

  it("chama a rota com deliver: 'link'", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        {
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: { actionLink: "https://app.local/set-password?token=NEW", email: "ana@example.com" },
        },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeClientDetailsService } = await import("./BackofficeClientDetailsService")
    const service = new BackofficeClientDetailsService()
    await service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })

    const call = fetchMock.mock.calls[0] as unknown as [string, { body?: string }]
    expect(call[0]).toContain("/access-email")
    expect(JSON.parse(call[1].body ?? "{}")).toEqual({
      mode: "invite",
      deliver: "link",
      accountMasterId: "master-1",
    })
  })
})
