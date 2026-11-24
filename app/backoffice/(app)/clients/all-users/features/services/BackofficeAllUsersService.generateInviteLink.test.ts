import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * "Copiar link do convite" na lista de todos os usuários. Reaproveita a rota de
 * access-email com deliver: "link" (gera o link sem disparar e-mail).
 */
describe("BackofficeAllUsersService.generateInviteLink", () => {
  afterEach(() => {
    mock.restore()
  })

  it("chama a rota com mode invite e deliver link", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        {
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: { actionLink: "https://app.local/set-password?token_hash=NEW&type=invite", email: "ana@example.com" },
        },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeAllUsersService } = await import("./BackofficeAllUsersService")
    const service = new BackofficeAllUsersService()
    await service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })

    const call = fetchMock.mock.calls[0] as unknown as [string, { method?: string; body?: string }]
    expect(call[0]).toContain("/backoffice/members/member-1/access-email")
    expect(call[1].method).toBe("POST")
    expect(JSON.parse(call[1].body ?? "{}")).toEqual({
      mode: "invite",
      deliver: "link",
      accountMasterId: "master-1",
    })
  })

  it("sucesso devolve o actionLink", async () => {
    const actionLink = "https://app.local/set-password?token_hash=NEW&type=invite"
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: true, successMessages: [], errorMessages: [], result: { actionLink, email: "ana@example.com" } },
        { status: 200 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeAllUsersService } = await import("./BackofficeAllUsersService")
    const service = new BackofficeAllUsersService()

    const result = await service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })
    expect(result.actionLink).toBe(actionLink)
  })

  it("falha devolve a mensagem de produto da API", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, successMessages: [], errorMessages: ["Membro não encontrado"], result: null },
        { status: 404 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficeAllUsersService } = await import("./BackofficeAllUsersService")
    const service = new BackofficeAllUsersService()

    await expect(
      service.generateInviteLink({ memberId: "member-1", accountMasterId: "master-1" })
    ).rejects.toThrow("Membro não encontrado")
  })
})
